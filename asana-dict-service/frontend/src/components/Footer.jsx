import React from 'react';
import '../styles/Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const startYear = 2025;
  const yearText = currentYear > startYear ? `${startYear}-${currentYear}` : String(startYear);

  return (
    <footer>
      © {yearText} Каталог асан
    </footer>
  );
};

export default Footer;

