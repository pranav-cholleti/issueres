import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { IssueList } from './pages/IssueList';
import { WorkflowDetail } from './pages/WorkflowDetail';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/:owner/:repo/issues" element={<IssueList />} />
        <Route path="/:owner/:repo/workflow/:issueId" element={<WorkflowDetail />} />
      </Routes>
    </Router>
  );
}