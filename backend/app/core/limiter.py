from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limiting configuration
limiter = Limiter(key_func=get_remote_address)
