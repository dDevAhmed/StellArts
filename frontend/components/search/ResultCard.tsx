
import { type FC } from 'react';
import { FaFileAlt } from 'react-icons/fa';
import { highlight } from './highlight';
import { type SearchResult } from './types';

interface ResultCardProps {
  result: SearchResult;
  keyword: string;
}

const ResultCard: FC<ResultCardProps> = ({ result, keyword }) => {
  const renderContent = () => {
    switch (result.type) {
      case 'user':
        return (
          <div className="flex items-center">
            <img
              src={result.avatar}
              alt={result.name}
              className="w-12 h-12 rounded-full mr-4"
            />
            <div>
              <h4 className="font-bold">
                {highlight(result.name, keyword)}
              </h4>
              <p className="text-gray-500">
                {highlight(result.role, keyword)}
              </p>
            </div>
          </div>
        );
      case 'document':
        return (
          <div className="flex items-center">
            <FaFileAlt className="w-8 h-8 mr-4 text-gray-500" />
            <div>
              <h4 className="font-bold">
                {highlight(result.title, keyword)}
              </h4>
              <p className="text-gray-500">
                Last modified: {result.lastModified}
              </p>
            </div>
          </div>
        );
      case 'transaction':
        return (
          <div>
            <h4 className="font-bold">Transaction: {result.id}</h4>
            <p className="text-gray-500">Amount: {result.amount}</p>
            <p className="text-gray-500">Date: {result.date}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 border rounded shadow-sm bg-white">
      {renderContent()}
    </div>
  );
};

export default ResultCard;