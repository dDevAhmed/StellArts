
import { type ReactNode } from 'react';

export const highlight = (text: string, keyword: string): ReactNode => {
  if (!keyword) {
    return text;
  }

  const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase() ? (
          <span key={i} style={{ backgroundColor: 'yellow' }}>
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};