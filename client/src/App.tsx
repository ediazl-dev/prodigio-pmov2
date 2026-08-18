import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import SowStage from "./pages/stages/SowStage";
import JiraStage from "./pages/stages/JiraStage";
import RisksStage from "./pages/stages/RisksStage";
import PlanningStage from "./pages/stages/PlanningStage";
import AvanceStage from "./pages/stages/AvanceStage";
import LinkedProjectDashboard from "./pages/stages/LinkedProjectDashboard";
import ExecutiveDashboardV2 from "./pages/stages/ExecutiveDashboardV2";
import ClosureStage from "./pages/stages/ClosureStage";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminTemplates from "./pages/admin/AdminTemplates";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminDeadlines from "./pages/admin/AdminDeadlines";
import ComplianceReport from "./pages/admin/ComplianceReport";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import JiraSpacesPage from "./pages/admin/JiraSpaces";
import AdminJiraToken from "./pages/admin/AdminJiraToken";
import JiraReport from "./pages/reports/JiraReport";
import JiraProjectDashboard from "./pages/reports/JiraProjectDashboard";
import RecurringServicesList from "./pages/RecurringServicesList";
import RecurringServiceCreate from "./pages/RecurringServiceCreate";
import RecurringServiceDetail from "./pages/RecurringServiceDetail";
import RSInitStage from "./pages/recurring/RSInitStage";
import RSWorkPlanStage from "./pages/recurring/RSWorkPlanStage";
import RSJsmSetupStage from "./pages/recurring/RSJsmSetupStage";
import RSExecutionStage from "./pages/recurring/RSExecutionStage";
import RSClosureStage from "./pages/recurring/RSClosureStage";
import InviteAccept from "./pages/InviteAccept";
import MyProfile from "./pages/MyProfile";
import { useAuth } from "./_core/hooks/useAuth";
import { ReactNode } from "react";

/** Guard component that restricts access to admin-only routes */
function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  const role = (user as any)?.role;
  if (role !== "admin") {
    return <Redirect to="/" />;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public routes - no sidebar */}
      <Route path="/invite/:token" component={InviteAccept} />
      {/* Dashboard routes - with sidebar */}
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/projects" component={Projects} />
            <Route path="/projects/:id" component={ProjectDetail} />
            <Route path="/projects/:id/sow" component={SowStage} />
            <Route path="/projects/:id/jira" component={JiraStage} />
            <Route path="/projects/:id/risks" component={RisksStage} />
            <Route path="/projects/:id/planning" component={PlanningStage} />
            <Route path="/projects/:id/design" component={AvanceStage} />
            <Route path="/projects/:id/linked-dashboard" component={LinkedProjectDashboard} />
            <Route path="/projects/:id/executive-dashboard-v2" component={ExecutiveDashboardV2} />
            <Route path="/projects/:id/closure" component={ClosureStage} />
            {/* Admin-only routes */}
            <Route path="/admin/users">{() => <AdminGuard><AdminUsers /></AdminGuard>}</Route>
            <Route path="/admin/finance">{() => <AdminGuard><AdminFinance /></AdminGuard>}</Route>
            <Route path="/admin/templates">{() => <AdminGuard><AdminTemplates /></AdminGuard>}</Route>
            <Route path="/admin/deadlines">{() => <AdminGuard><AdminDeadlines /></AdminGuard>}</Route>
            <Route path="/admin/compliance">{() => <AdminGuard><ComplianceReport /></AdminGuard>}</Route>
            <Route path="/admin/audit">{() => <AdminGuard><AdminAuditLog /></AdminGuard>}</Route>
            <Route path="/admin/jira-spaces">{() => <AdminGuard><JiraSpacesPage /></AdminGuard>}</Route>
            <Route path="/admin/jira-token">{() => <AdminGuard><AdminJiraToken /></AdminGuard>}</Route>
            <Route path="/recurring-services" component={RecurringServicesList} />
            <Route path="/recurring-services/new" component={RecurringServiceCreate} />
            <Route path="/recurring-services/:id" component={RecurringServiceDetail} />
            <Route path="/recurring-services/:id/init" component={RSInitStage} />
            <Route path="/recurring-services/:id/work-plan" component={RSWorkPlanStage} />
            <Route path="/recurring-services/:id/jsm-setup" component={RSJsmSetupStage} />
            <Route path="/recurring-services/:id/execution" component={RSExecutionStage} />
            <Route path="/recurring-services/:id/closure" component={RSClosureStage} />
            <Route path="/reports/jira" component={JiraReport} />
            <Route path="/reports/jira/:projectKey" component={JiraProjectDashboard} />
            <Route path="/admin/settings">{() => <AdminGuard><AdminSettings /></AdminGuard>}</Route>
            <Route path="/profile" component={MyProfile} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
