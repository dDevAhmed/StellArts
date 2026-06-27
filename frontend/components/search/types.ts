
export type SearchResult =
  | {
      type: 'user';
      id: string;
      name: string;
      avatar: string;
      role: string;
    }
  | {
      type: 'document';
      id: string;
      title: string;
      lastModified: string;
    }
  | {
      type: 'transaction';
      id: string;
      amount: number;
      date: string;
    };