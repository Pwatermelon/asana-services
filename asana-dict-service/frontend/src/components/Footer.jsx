import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const startYear = 2025;
  const yearText = currentYear > startYear ? `${startYear}-${currentYear}` : String(startYear);

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="site-footer-copy">
          © {yearText} Каталог асан традиционных школ йоги · некоммерческий проект СГТУ
        </p>
        <nav className="site-footer-nav" aria-label="Навигация в подвале">
          <Link to="/asanas">Каталог</Link>
          <Link to="/sources">Источники</Link>
          <Link to="/about">О проекте</Link>
          <a href="mailto:zhukov.jm@gmail.com">zhukov.jm@gmail.com</a>
          <a href="https://www.sstu.ru/" target="_blank" rel="noopener noreferrer">
            СГТУ
          </a>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
