
import { type FC, useState, useEffect } from 'react';

interface FacetedSidebarProps {
  onCategoriesChange: (categories: string[]) => void;
  onDateRangeChange: (dateRange: { startDate: string; endDate: string }) => void;
  onStatusChange: (status: string) => void;
}

const FacetedSidebar: FC<FacetedSidebarProps> = ({
  onCategoriesChange,
  onDateRangeChange,
  onStatusChange,
}) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    onCategoriesChange(categories);
  }, [categories, onCategoriesChange]);

  useEffect(() => {
    onDateRangeChange({ startDate, endDate });
  }, [startDate, endDate, onDateRangeChange]);

  useEffect(() => {
    onStatusChange(status);
  }, [status, onStatusChange]);

  const handleCategoryChange = (category: string) => {
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  return (
    <aside className="w-64 p-4 bg-gray-100">
      <h3 className="text-lg font-bold mb-4">Filters</h3>
      <div className="mb-4">
        <h4 className="font-semibold mb-2">Category</h4>
        <div className="flex items-center mb-2">
          <input
            type="checkbox"
            id="users"
            name="users"
            className="mr-2"
            onChange={() => handleCategoryChange('user')}
          />
          <label htmlFor="users">Users</label>
        </div>
        <div className="flex items-center mb-2">
          <input
            type="checkbox"
            id="documents"
            name="documents"
            className="mr-2"
            onChange={() => handleCategoryChange('document')}
          />
          <label htmlFor="documents">Documents</label>
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="transactions"
            name="transactions"
            className="mr-2"
            onChange={() => handleCategoryChange('transaction')}
          />
          <label htmlFor="transactions">Transactions</label>
        </div>
      </div>
      <div className="mb-4">
        <h4 className="font-semibold mb-2">Date Range</h4>
        <div className="mb-2">
          <label htmlFor="start-date" className="block mb-1">
            Start Date
          </label>
          <input
            type="date"
            id="start-date"
            name="start-date"
            className="w-full p-2 border rounded"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block mb-1">
            End Date
          </label>
          <input
            type="date"
            id="end-date"
            name="end-date"
            className="w-full p-2 border rounded"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div>
        <h4 className="font-semibold mb-2">Status</h4>
        <select
          name="status"
          id="status"
          className="w-full p-2 border rounded"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </aside>
  );
};

export default FacetedSidebar;