"""
Soroban smart contract integration for StellArts.
Handles all interactions with Soroban contracts on the Stellar network.
"""

import logging
import time
from typing import Any

from stellar_sdk import (
    Keypair,
    Network,
    SorobanServer,
    TransactionBuilder,
    scval,
)
from stellar_sdk import (
    xdr as stellar_xdr,
)
from stellar_sdk.soroban_rpc import SendTransactionStatus

from app.core.config import settings

logger = logging.getLogger(__name__)

# Soroban configuration
_soroban_server: SorobanServer | None = None

def get_soroban_server() -> SorobanServer:
    global _soroban_server
    if _soroban_server is None:
        rpc_url = settings.STELLAR_RPC_URL
        if not rpc_url:
            raise RuntimeError("STELLAR_RPC_URL is not configured")
        _soroban_server = SorobanServer(rpc_url)
    return _soroban_server

def get_network_passphrase() -> str:
    return settings.SOROBAN_NETWORK_PASSPHRASE or settings.STELLAR_NETWORK_PASSPHRASE or Network.TESTNET_NETWORK_PASSPHRASE


def invoke_contract_function(
    contract_id: str,
    function_name: str,
    args: list[stellar_xdr.SCVal],
    source_keypair: Keypair,
    timeout_seconds: int = 60,
) -> dict[str, Any]:
    """
    Build, simulate, sign, and submit a Soroban contract invocation.

    Args:
        contract_id: The contract ID to invoke
        function_name: Name of the function to call
        args: List of SCVal arguments
        source_keypair: Keypair of the transaction submitter
        timeout_seconds: Maximum time to wait for confirmation

    Returns:
        Dictionary with transaction hash, status, and result

    Raises:
        RuntimeError: If simulation or submission fails
        TimeoutError: If transaction confirmation times out
    """
    try:
        # Load source account
        server = get_soroban_server()
        source_account = server.load_account(source_keypair.public_key)

        # Build transaction
        tx = (
            TransactionBuilder(
                source_account=source_account,
                network_passphrase=get_network_passphrase(),
                base_fee=300,
            )
            .append_invoke_contract_function_op(
                contract_id=contract_id,
                function_name=function_name,
                parameters=args,
            )
            .build()
        )

        # Simulate transaction
        logger.info(f"Simulating {function_name} on contract {contract_id[:8]}...")
        sim_response = server.simulate_transaction(tx)

        if hasattr(sim_response, "error") and sim_response.error:
            error_msg = f"Simulation failed: {sim_response.error}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        # Prepare and sign
        tx = server.prepare_transaction(tx, sim_response)
        tx.sign(source_keypair)

        # Submit
        logger.info(f"Submitting {function_name} transaction...")
        send_response = server.send_transaction(tx)

        if send_response.status == SendTransactionStatus.ERROR:
            error_msg = f"Transaction failed: {send_response.error_result_xdr}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        # Wait for confirmation
        tx_hash = send_response.hash
        logger.info(f"Transaction submitted with hash: {tx_hash}")

        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            status_response = server.get_transaction_status(tx_hash)

            if status_response.status == "SUCCESS":
                logger.info(f"Transaction {tx_hash} confirmed successfully")
                return {
                    "success": True,
                    "hash": tx_hash,
                    "result": status_response.result_xdr,
                }
            elif status_response.status == "FAILED":
                error_msg = (
                    f"Transaction {tx_hash} failed: {status_response.result_xdr}"
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg)

            time.sleep(2)

        raise TimeoutError(
            f"Transaction {tx_hash} not confirmed within {timeout_seconds} seconds"
        )

    except Exception as e:
        logger.error(f"Error in invoke_contract_function: {str(e)}")
        raise RuntimeError(f"Failed to invoke contract function: {str(e)}") from e


def get_escrow_contract_id() -> str | None:
    return settings.ESCROW_CONTRACT_ID

def get_reputation_contract_id() -> str | None:
    return settings.REPUTATION_CONTRACT_ID

def get_backend_signer() -> Keypair | None:
    secret = settings.BACKEND_SECRET_KEY
    if not secret:
        if settings.DEBUG:
            return Keypair.random()
        return None
    try:
        return Keypair.from_secret(secret)
    except Exception:
        if settings.DEBUG:
            return Keypair.random()
        return None


def initialize_escrow_contract(
    source_keypair: Keypair,
    client: str,
    artisan: str,
    amount: int,
    deadline: int
) -> dict[str, Any]:
    """Initialize the escrow contract with backend as admin."""
    contract_id = get_escrow_contract_id()
    if not contract_id:
        return {"success": False, "message": "Escrow contract ID not configured"}
        
    args = [
        scval.to_address(client),
        scval.to_address(artisan),
        scval.to_int128(amount),
        scval.to_uint64(deadline)
    ]
    invoke_contract_function(
        contract_id,
        "initialize",
        args,
        source_keypair,
    )
    return {"success": True, "message": "Escrow contract initialized"}


def get_reputation_stats(
    artisan_address: str, source_keypair: Keypair
) -> tuple[int, int]:
    """
    Get on-chain reputation stats for an artisan.

    Args:
        artisan_address: Artisan's Stellar address
        source_keypair: Keypair of the transaction submitter

    Returns:
        Tuple of (average_score_scaled_by_100, review_count)
    """
    contract_id = get_reputation_contract_id()
    if not contract_id:
        return (0, 0)
        
    args = [scval.to_address(artisan_address)]

    try:
        result = invoke_contract_function(
            contract_id,
            "get_stats",
            args,
            source_keypair,
        )
        
        # Parse the result
        # Assuming the contract returns a tuple of (average_rating, rating_count)
        # represented as a vec or tuple in XDR.
        if "result" in result:
            result_val = stellar_xdr.SCVal.from_xdr(result["result"])
            if result_val.type == stellar_xdr.SCValType.SCV_VEC and result_val.vec is not None:
                vec = result_val.vec.sc_vec
                if len(vec) >= 2:
                    avg_rating = getattr(vec[0], 'u32', 0)
                    rating_count = getattr(vec[1], 'u32', 0)
                    return (avg_rating, rating_count)
    except Exception as e:
        logger.error(f"Failed to get reputation stats: {e}")
        
    return (0, 0)


def transition_to_in_progress(engagement_id: int) -> dict[str, Any]:
    """
    Transition escrow status from Funded to InProgress.
    Called by the backend Oracle upon artisan arrival.
    """
    contract_id = get_escrow_contract_id()
    if not contract_id:
        raise RuntimeError("Escrow contract ID not configured")
        
    # Convert engagement_id to Soroban Uint64
    args = [scval.to_uint64(engagement_id)]

    signer = get_backend_signer()
    if not signer:
        raise RuntimeError("Backend signer not configured")

    return invoke_contract_function(
        contract_id,
        "start_job",
        args,
        signer,
    )

def prepare_escrow_deposit(booking_id: str, client_address: str, token: str, amount: int) -> str:
    """Builds the Soroban invocation and returns unsigned transaction XDR for wallet signing."""
    contract_id = get_escrow_contract_id()
    if not contract_id:
        raise RuntimeError("Escrow contract ID not configured")
        
    server = get_soroban_server()
    source_account = server.load_account(client_address)

    args = [
        scval.to_address(client_address),
        scval.to_address(token),
        scval.to_int128(amount)
    ]

    tx = (
        TransactionBuilder(
            source_account=source_account,
            network_passphrase=get_network_passphrase(),
            base_fee=300,
        )
        .append_invoke_contract_function_op(
            contract_id=contract_id,
            function_name="deposit",
            parameters=args,
        )
        .build()
    )

    # Note: For wallet signing, we may not need to prepare_transaction because the wallet handles fee bumping and auth.
    # We just return the XDR.
    return tx.to_xdr()

def prepare_escrow_release(engagement_id: int, client_address: str, token: str) -> str:
    """Builds the release invocation and returns unsigned XDR."""
    contract_id = get_escrow_contract_id()
    if not contract_id:
        raise RuntimeError("Escrow contract ID not configured")
        
    server = get_soroban_server()
    source_account = server.load_account(client_address)

    args = [
        scval.to_uint64(engagement_id)
    ]

    tx = (
        TransactionBuilder(
            source_account=source_account,
            network_passphrase=get_network_passphrase(),
            base_fee=300,
        )
        .append_invoke_contract_function_op(
            contract_id=contract_id,
            function_name="release",
            parameters=args,
        )
        .build()
    )

    return tx.to_xdr()

def submit_soroban_transaction(signed_xdr: str, timeout_seconds: int = 60) -> dict[str, Any]:
    """Submits the signed transaction, polls the Soroban RPC, waits for completion, and returns the result."""
    server = get_soroban_server()
    from stellar_sdk import TransactionEnvelope
    
    tx = TransactionEnvelope.from_xdr(signed_xdr, network_passphrase=get_network_passphrase())
    
    logger.info("Submitting signed Soroban transaction...")
    send_response = server.send_transaction(tx)

    if send_response.status == SendTransactionStatus.ERROR:
        error_msg = f"Transaction failed: {send_response.error_result_xdr}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)

    tx_hash = send_response.hash
    logger.info(f"Transaction submitted with hash: {tx_hash}")

    import time
    start_time = time.time()
    while time.time() - start_time < timeout_seconds:
        status_response = server.get_transaction_status(tx_hash)

        if status_response.status == "SUCCESS":
            logger.info(f"Transaction {tx_hash} confirmed successfully")
            return {
                "status": "SUCCESS",
                "hash": tx_hash,
                "result": status_response.result_xdr,
            }
        elif status_response.status == "FAILED":
            error_msg = f"Transaction {tx_hash} failed: {status_response.result_xdr}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        time.sleep(2)

    raise TimeoutError(f"Transaction {tx_hash} not confirmed within {timeout_seconds} seconds")
