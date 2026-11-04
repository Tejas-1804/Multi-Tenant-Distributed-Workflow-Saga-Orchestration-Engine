import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { WorkflowBuilderPage } from './pages/WorkflowBuilderPage.tsx';
import { WorkflowsListPage } from './pages/WorkflowsListPage.tsx';
import { ExecutionsListPage } from './pages/ExecutionsListPage.tsx';
import { ExecutionDetailPage } from './pages/ExecutionDetailPage.tsx';
import { TemplatesPage } from './pages/TemplatesPage.tsx';
import { TenantsPage } from './pages/TenantsPage.tsx';
import { WorkersPage } from './pages/WorkersPage.tsx';
import { MonitoringPage } from './pages/MonitoringPage.tsx';
import { AlertsPage } from './pages/AlertsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { useWebSocket } from './hooks/useWebSocket.ts';
import api from './services/api.ts';

function AppContent() {
  const { user, tenant, isLoading } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>('EX-1002');
  const [alertCount, setAlertCount] = useState<number>(3);

  // Connect WebSocket to active tenant
  const { isConnected, lastEvent } = useWebSocket(tenant?.id);

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans text-xs ${
        isDark ? 'bg-[#0B1220] text-slate-400' : 'bg-[#f8fafc] text-slate-500'
      }`}>
        <div className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border shadow-lg ${
          isDark ? 'bg-[#172235] border-[#1E2D4A] text-slate-200' : 'bg-white border-slate-200 text-slate-700'
        }`}>
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
          <span className="font-semibold">Connecting to NexusFlow Engine...</span>
        </div>
      </div>
    );
  }

  // User specifically requested: "and also start from the register and signup page"
  if (!user) {
    return <AuthPage initialMode="register" />;
  }

  const handleOpenWorkflowBuilder = (workflowId?: string) => {
    setActiveWorkflowId(workflowId || null);
    setCurrentTab('builder');
  };

  const handleOpenExecutionDetail = (executionId: string) => {
    setActiveExecutionId(executionId);
    setCurrentTab('execution-detail');
  };

  return (
    <div className={`min-h-screen flex font-sans selection:bg-blue-500/30 selection:text-blue-200 transition-colors duration-200 ${
      isDark
        ? 'bg-gradient-to-br from-[#0B1220] via-[#0F172A] to-[#172033] text-slate-100'
        : 'bg-[#f8fafc] text-slate-900'
    }`}>
      {/* Left Deep Navy Navigation Sidebar matching #070D18 */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={tab => {
          if (tab === 'workflows') setActiveWorkflowId(null);
          if (tab === 'executions') {
            setActiveExecutionId('EX-1002');
            setCurrentTab('execution-detail');
            return;
          }
          setCurrentTab(tab);
        }}
        alertCount={alertCount}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Header */}
        <Navbar
          onNavigateTab={tab => setCurrentTab(tab)}
        />

        {/* Dynamic Page Content */}
        <main className={`flex-1 overflow-y-auto ${
          isDark
            ? 'bg-gradient-to-br from-[#0B1220] via-[#0F172A] to-[#172033]'
            : 'bg-[#f8fafc]'
        }`}>
          {currentTab === 'dashboard' && (
            <DashboardPage
              onOpenWorkflowBuilder={handleOpenWorkflowBuilder}
              onOpenExecutionDetail={handleOpenExecutionDetail}
              onNavigateTab={tab => {
                if (tab === 'executions') {
                  setActiveExecutionId('EX-1002');
                  setCurrentTab('execution-detail');
                } else {
                  setCurrentTab(tab);
                }
              }}
            />
          )}

          {currentTab === 'workflows' && (
            <WorkflowsListPage
              onOpenBuilder={handleOpenWorkflowBuilder}
              onOpenExecution={handleOpenExecutionDetail}
            />
          )}

          {currentTab === 'builder' && (
            <WorkflowBuilderPage
              workflowId={activeWorkflowId}
              onBack={() => setCurrentTab('workflows')}
              onOpenExecutionDetail={handleOpenExecutionDetail}
            />
          )}

          {currentTab === 'executions' && (
            <ExecutionsListPage onOpenExecution={handleOpenExecutionDetail} />
          )}

          {currentTab === 'execution-detail' && (
            <ExecutionDetailPage
              executionId={activeExecutionId || 'EX-1002'}
              onBack={() => setCurrentTab('executions')}
              onOpenWorkflow={handleOpenWorkflowBuilder}
            />
          )}

          {currentTab === 'templates' && (
            <TemplatesPage
              onInstantiateTemplate={wfId => handleOpenWorkflowBuilder(wfId)}
            />
          )}

          {currentTab === 'tenants' && <TenantsPage />}

          {currentTab === 'workers' && <WorkersPage />}

          {currentTab === 'monitoring' && <MonitoringPage />}

          {currentTab === 'alerts' && <AlertsPage />}

          {currentTab === 'settings' && <SettingsPage />}

          {currentTab === 'auth' && <AuthPage initialMode="register" />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
