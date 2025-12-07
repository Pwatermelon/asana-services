import React, { useState, useRef, useEffect } from 'react';
import '../styles/SearchableSelect.css';

const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Выберите...',
  getOptionLabel = (option) => option.label || option.name || option.title || String(option),
  getOptionValue = (option) => option.value || option.id || String(option),
  required = false,
  className = '',
  style = {},
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState([]);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Сортируем и фильтруем опции
  useEffect(() => {
    let filtered = [...options];
    
    // Сортируем по алфавиту
    filtered.sort((a, b) => {
      const labelA = getOptionLabel(a).toLowerCase();
      const labelB = getOptionLabel(b).toLowerCase();
      return labelA.localeCompare(labelB, 'ru');
    });
    
    // Фильтруем по поисковому запросу
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(option => {
        const label = getOptionLabel(option).toLowerCase();
        return label.includes(term);
      });
    }
    
    setFilteredOptions(filtered);
  }, [options, searchTerm, getOptionLabel]);

  // Закрываем при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Фокусируемся на поле поиска при открытии
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => getOptionValue(opt) === value);
  const displayValue = selectedOption ? getOptionLabel(selectedOption) : '';

  const handleSelect = (option) => {
    onChange(getOptionValue(option));
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchTerm('');
      }
    }
  };

  return (
    <div 
      ref={wrapperRef} 
      className={`searchable-select ${className} ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
      style={style}
    >
      <div 
        className="searchable-select-trigger"
        onClick={handleToggle}
      >
        <span className={!value ? 'placeholder' : ''}>
          {displayValue || placeholder}
        </span>
        <span className="searchable-select-arrow">▼</span>
      </div>
      
      {isOpen && (
        <div className="searchable-select-dropdown">
          <div className="searchable-select-search">
            <input
              ref={inputRef}
              type="text"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="searchable-select-input"
            />
          </div>
          <div className="searchable-select-options">
            {filteredOptions.length === 0 ? (
              <div className="searchable-select-no-results">
                Ничего не найдено
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const optionValue = getOptionValue(option);
                const optionLabel = getOptionLabel(option);
                const isSelected = value === optionValue;
                
                return (
                  <div
                    key={optionValue}
                    className={`searchable-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(option)}
                  >
                    {optionLabel}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      
      {required && !value && (
        <input
          type="text"
          required
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          tabIndex={-1}
        />
      )}
    </div>
  );
};

export default SearchableSelect;

