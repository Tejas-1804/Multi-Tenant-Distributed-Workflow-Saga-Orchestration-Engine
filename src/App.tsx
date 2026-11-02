import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { WorkflowBuilderPage } from './pages/WorkflowBuilderPage.tsx';
import { WorkflowsListPage } from './pages/WorkflowsListPage.tsx';
import { ExecutionsListPage } from './pages/ExecutionsListPage.tsx';
import { ExecutionDetailPage } from './pages/ExecutionDetailPage.tsx';
import { DLQPage } from './pages/DLQPage.tsx';
import { ApiKeysPage } from './pages/ApiKeysPage.tsx';
import { AuditLogsPage } from './pages/AuditLogsPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { useWebSocket } from './hooks/useWebSocket.ts';
import api from './services/api.ts';

function AppContent() {
  const { user, tenant, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [dlqCount, setDlqCount] = useState<number>(0);
  const [workerCount, setWorkerCount] = useState<number>(3);

  // Connect WebSocket to active tenant
  const { isConnected, lastEvent } = useWebSocket(tenant?.id);

  // Fetch initial telemetry for navbar & badges
  useEffect(() => {
    if (!tenant?.id) return;
    const fetchBadges = async () => {
      try {
        const [dlqRes, statsRes] = await Promise.all([
          api.get('/dlq'),
          api.get('/admin/statistics'),
        ]);
        setDlqCount(dlqRes.data.filter((j: any) => j.status === 'UNRESOLVED').length);
        if (statsRes.data?.workers) {
          setWorkerCount(statsRes.data.workers.length);
        }
      } catch (err) {
        // silently fallback
      }
    };
    fetchBadges();
    const interval = setInterval(fetchBadges, 8000);
    return () => clearInterval(interval);
  }, [tenant?.id]);

  // Handle incoming live events
  useEffect(() => {
    if (lastEvent?.type === 'DLQ_JOB_ADDED') {
      setDlqCount(prev => prev + 1);
    }
  }, [lastEvent]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Bootstrapping Distributed Workflow & Saga Engine...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, render dedicated Login / Registration screen
  if (!user) {
    return <AuthPage initialMode="login" />;
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Enterprise Header */}
      <Navbar
        isWsConnected={isConnected}
        workerCount={workerCount}
        onNavigateTab={tab => setCurrentTab(tab)}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={tab => {
            if (tab === 'workflows') setActiveWorkflowId(null);
            setCurrentTab(tab);
          }}
          dlqCount={dlqCount}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-y-auto bg-zinc-950">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onOpenWorkflowBuilder={handleOpenWorkflowBuilder}
              onOpenExecutionDetail={handleOpenExecutionDetail}
              onNavigateTab={tab => setCurrentTab(tab)}
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

          {currentTab === 'execution-detail' && activeExecutionId && (
            <ExecutionDetailPage
              executionId={activeExecutionId}
              onBack={() => setCurrentTab('executions')}
              onOpenWorkflow={handleOpenWorkflowBuilder}
            />
          )}

          {currentTab === 'dlq' && (
            <DLQPage onOpenExecution={handleOpenExecutionDetail} />
          )}

          {currentTab === 'apikeys' && <ApiKeysPage />}

          {currentTab === 'audit' && <AuditLogsPage />}

          {currentTab === 'admin' && <AdminPage />}

          {currentTab === 'auth' && <AuthPage initialMode="register" />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
