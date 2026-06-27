
import { type FC, useState } from 'react';
import FacetedSidebar from '@/components/search/FacetedSidebar';
import ResultCard from '@/components/search/ResultCard';
import { type SearchResult } from '@/components/search/types';

const mockResults: SearchResult[] = [
  {
    type: 'user',
    id: '1',
    name: 'John Doe',
    avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
    role: 'Admin',
  },
  {
    type: 'document',
    id: '2',
    title: 'Project Proposal',
    lastModified: '2024-06-26',
  },
  {
    type: 'transaction',
    id: '3',
    amount: 100,
    date: '2024-06-26',
  },
];

const SearchPage: FC = () => {
  const [keyword, setKeyword] = useState('');
  const [visibleResults, setVisibleResults] = useState(2);
  const [categories, setCategories] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [focusedResult, setFocusedResult] = useState(-1);

  const loadMore = () => {
    setVisibleResults((prev) => prev + 2);
  };

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [categories, dateRange, status]);

  const filteredResults = mockResults
    .filter((result) => {
      if (categories.length === 0) {
        return true;
      }
      return categories.includes(result.type);
    })
    .filter((result) => {
      if (keyword === '') {
        return true;
      }
      if (result.type === 'user') {
        return result.name.toLowerCase().includes(keyword.toLowerCase());
      }
      if (result.type === 'document') {
        return result.title.toLowerCase().includes(keyword.toLowerCase());
      }
      return false;
    })
    .filter((result) => {
      if (status === 'all') {
        return true;
      }
      if (result.type === 'user') {
        return result.status === status;
      }
      return true;
    })
    .filter((result) => {
      if (dateRange.startDate === '' || dateRange.endDate === '') {
        return true;
      }
      const resultDate = new Date(result.date);
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      return resultDate >= startDate && resultDate <= endDate;
    });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setFocusedResult((prev) =>
          Math.min(prev + 1, filteredResults.length - 1)
        );
      } else if (e.key === 'ArrowUp') {
        setFocusedResult((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredResults]);

  return (
    <div className="flex">
      <FacetedSidebar
        onCategoriesChange={setCategories}
        onDateRangeChange={setDateRange}
        onStatusChange={setStatus}
      />
      <main className="flex-1 p-4">
        <h1 className="text-2xl font-bold mb-4">Search Results</h1>
        <input
          type="text"
          placeholder="Search..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="w-full p-2 border rounded mb-4"
        />
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            {filteredResults.length > 0 ? (
              filteredResults
                .slice(0, visibleResults)
                .map((result, index) => (
                  <div
                    key={result.id}
                    className={`${
                      focusedResult === index ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <ResultCard result={result} keyword={keyword} />
                  </div>
                ))
            ) : (
              <div className="text-center py-10">
                <h2 className="text-xl font-semibold">No Results Found</h2>
                <p className="text-gray-500">
                  Try searching for something else.
                </p>
              </div>
            )}
          </div>
        </div>
        {visibleResults < filteredResults.length && (
          <button
            onClick={loadMore}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Load More
          </button>
        )}
      </main>
    </div>
  );
};

export default SearchPage;