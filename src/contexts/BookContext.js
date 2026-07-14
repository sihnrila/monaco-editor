import React, { createContext, useContext, useState } from 'react';

const BookContext = createContext();

export const useBook = () => {
  const context = useContext(BookContext);
  if (!context) {
    throw new Error('useBook must be used within a BookProvider');
  }
  return context;
};

export const BookProvider = ({ children }) => {
  const [bookInfo, setBookInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const value = {
    bookInfo,
    setBookInfo,
    isLoading,
    setIsLoading
  };

  return (
    <BookContext.Provider value={value}>
      {children}
    </BookContext.Provider>
  );
};

