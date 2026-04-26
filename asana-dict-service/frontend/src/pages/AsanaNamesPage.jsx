import React from 'react';
import AsanaNamesAdmin from '../components/admin/AsanaNamesAdmin';
import '../styles/Admin.css';

const AsanaNamesPage = () => {
  return (
    <div className="container admin-page admin-page--expert-names">
      <h1 className="admin-title">Названия</h1>
      <AsanaNamesAdmin />
    </div>
  );
};

export default AsanaNamesPage;
