import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

// Embedded/sandboxed hosts don't own the page URL, so they use in-memory routing.
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter;
import { Toaster } from 'sonner';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAccess, RequireAuth } from '@/auth/guards';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { ConfirmProvider } from '@/components/ui/confirm';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';
import { ACCESS } from '@/components/layout/nav';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { EmployeesPage } from '@/features/employees/EmployeesPage';
import { EmployeeProfilePage } from '@/features/employees/EmployeeProfilePage';
import { DepartmentsPage } from '@/features/departments/DepartmentsPage';
import { AttendancePage } from '@/features/attendance/AttendancePage';
import { LeavePage } from '@/features/leave/LeavePage';
import { PayrollPage } from '@/features/payroll/PayrollPage';
import { PerformancePage } from '@/features/performance/PerformancePage';
import { RecruitmentPage } from '@/features/recruitment/RecruitmentPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { NotFoundPage } from '@/features/NotFoundPage';

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="bottom-right" richColors closeButton toastOptions={{ duration: 4000 }} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ConfirmProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  element={
                    <RequireAuth>
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/employees" element={<RequireAccess check={ACCESS.employees} message="The employee directory is available to HR and Super Admins. You can view your own profile from the sidebar."><EmployeesPage /></RequireAccess>} />
                  <Route path="/employees/:id" element={<EmployeeProfilePage />} />
                  <Route path="/departments" element={<RequireAccess check={ACCESS.departments}><DepartmentsPage /></RequireAccess>} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/leave-management" element={<LeavePage />} />
                  <Route path="/payroll" element={<PayrollPage />} />
                  <Route path="/performance" element={<PerformancePage />} />
                  <Route path="/recruitment" element={<RequireAccess check={ACCESS.recruitment}><RecruitmentPage /></RequireAccess>} />
                  <Route path="/reports" element={<RequireAccess check={ACCESS.reports}><ReportsPage /></RequireAccess>} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
              <ThemedToaster />
            </AuthProvider>
          </Router>
        </ConfirmProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
