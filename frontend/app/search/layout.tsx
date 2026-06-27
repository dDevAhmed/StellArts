
import { type FC, type ReactNode } from 'react';

interface SearchLayoutProps {
  children: ReactNode;
}

const SearchLayout: FC<SearchLayoutProps> = ({ children }) => {
  return <div>{children}</div>;
};

export default SearchLayout;