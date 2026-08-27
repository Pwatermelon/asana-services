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
        <div className="site-footer-grid">
          <div className="site-footer-col site-footer-col--brand">
            <Link to="/asanas" className="site-footer-brand">
              Каталог асан
            </Link>
            <p className="site-footer-tagline">
              Справочник асан традиционных школ йоги: названия, иллюстрации
              из первоисточников и связи между школами.
            </p>
          </div>

          <nav className="site-footer-col" aria-label="Разделы сайта">
            <h2 className="site-footer-heading">Разделы</h2>
            <ul className="site-footer-list">
              <li>
                <Link to="/asanas">Каталог</Link>
              </li>
              <li>
                <Link to="/sources">Источники</Link>
              </li>
              <li>
                <Link to="/about">О проекте</Link>
              </li>
            </ul>
          </nav>

          <div className="site-footer-col">
            <h2 className="site-footer-heading">Контакты</h2>
            <ul className="site-footer-list site-footer-contacts">
              <li>
                <span className="site-footer-contact-label">Техническая поддержка</span>
                <a href="mailto:zhukov.jm@gmail.com">zhukov.jm@gmail.com</a>
              </li>
              <li>
                <span className="site-footer-contact-label">По вопросам проекта</span>
                <a href="mailto:taiss@yandex.ru">taiss@yandex.ru</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="site-footer-bottom">
          <p className="site-footer-copy">
            © {yearText} Каталог асан традиционных школ йоги
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
