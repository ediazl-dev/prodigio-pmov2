import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  BookOpen,
  Building2,
  ChevronDown,
  Clock,
  FileClock,
  FolderKanban,
  KeyRound,
  Headphones,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  LineChart,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663043443217/bXMkzYF2PmF6AbhicJnZQ6/Prodigio-Logo-500_f9858498.png";

/* ── Role badge colors per Prodigio Guide ── */
const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  admin:   { label: "Admin",    cls: "bg-rose-500/20 text-rose-300" },
  pmo:     { label: "PMO",      cls: "bg-sky-500/20 text-sky-300" },
  pm:      { label: "PM",       cls: "bg-violet-500/20 text-violet-300" },
  bde:     { label: "BDE",      cls: "bg-amber-500/20 text-amber-300" },
  consulta:{ label: "Consulta", cls: "bg-slate-500/20 text-slate-300" },
};

/* ── Menu structure ── */
const mainMenuItems = [
  { icon: LayoutDashboard, label: "Consola", path: "/" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FolderKanban, label: "PMO Proyectos", path: "/projects" },
  { icon: RefreshCw, label: "Servicios Recurrentes", path: "/recurring-services" },
];

const reportMenuItems = [
  { icon: LineChart, label: "Avance JIRA", path: "/reports/jira" },
];

const adminMenuItems = [
  { icon: Users, label: "Usuarios", path: "/admin/users" },
  { icon: BarChart3, label: "Financiero", path: "/admin/finance" },
  { icon: RefreshCw, label: "Sincronización Financiera", path: "/admin/financial-sync" },
  { icon: BarChart3, label: "Consolidado Facturación", path: "/admin/financial-consolidated" },
  { icon: Clock, label: "Plazos por Etapa", path: "/admin/deadlines" },
  { icon: TrendingUp, label: "Cumplimiento", path: "/admin/compliance" },
  { icon: Shield, label: "Auditoría", path: "/admin/audit" },
  { icon: FileClock, label: "Evidencia documental", path: "/admin/evidence-history" },
  { icon: Building2, label: "Spaces JIRA", path: "/admin/jira-spaces" },
  { icon: Headphones, label: "Spaces JSM", path: "/admin/jsm-spaces" },
  { icon: BookOpen, label: "Plantillas", path: "/admin/templates" },
  { icon: KeyRound, label: "Token JIRA", path: "/admin/jira-token" },
  { icon: Settings, label: "Configuración", path: "/admin/settings" },
];

/* ── Resize / section persistence ── */
const SIDEBAR_WIDTH_KEY = "prodigio-sidebar-width";
const SIDEBAR_SECTIONS_KEY = "pmo-sidebar-sections";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

type SectionState = { principal: boolean; reportes: boolean; admin: boolean };

const DEFAULT_SECTIONS: SectionState = { principal: true, reportes: true, admin: true };

function loadSectionState(): SectionState {
  try {
    const saved = localStorage.getItem(SIDEBAR_SECTIONS_KEY);
    if (saved) return { ...DEFAULT_SECTIONS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SECTIONS;
}

/* ════════════════════════════════════════════
   Root component
   ════════════════════════════════════════════ */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#0F1A2E" }}>
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="h-20 w-20 rounded-2xl ring-1 ring-white/10 overflow-hidden flex items-center justify-center bg-white/5">
            <img src={LOGO_URL} alt="Prodigio Tech" className="w-16 h-16 object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-white mb-2">Prodigio</h1>
            <p className="text-[13px] text-white/50">
              Gestión de Proyectos Asistida por IA
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Iniciar Sesión con SSO
          </Button>
          <p className="text-[11px] text-white/30 text-center">
            Acceso restringido a usuarios autorizados de Prodigio Tech
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

/* ════════════════════════════════════════════
   Sidebar section (collapsible)
   ════════════════════════════════════════════ */
function SidebarSection({
  title,
  items,
  isOpen,
  onToggle,
  isCollapsed,
  isActive,
  onNavigate,
  count,
}: {
  title: string;
  items: { icon: React.ElementType; label: string; path: string }[];
  isOpen: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
  count?: number;
}) {
  const hasActiveChild = items.some((item) => isActive(item.path));

  /* Collapsed mode: just icons */
  if (isCollapsed) {
    return (
      <SidebarMenu className="px-2 gap-0.5">
        {items.map((item) => {
          const active = isActive(item.path);
          return (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                isActive={active}
                onClick={() => onNavigate(item.path)}
                tooltip={item.label}
                className={`h-9 transition-all duration-200 rounded-lg ${
                  active
                    ? "bg-gradient-to-r from-rose-500/20 to-rose-500/5 text-white shadow-sm shadow-rose-500/10"
                    : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                <item.icon className={`h-4 w-4 ${active ? "text-rose-400" : ""}`} />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} className="group/section">
      {/* Section label */}
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center gap-2 w-[calc(100%-16px)] mx-2 px-2 py-2 cursor-pointer select-none group/trigger"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30 group-hover/trigger:text-white/50 transition-colors">
            {title}
          </span>
          {count !== undefined && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              hasActiveChild ? "bg-rose-500/20 text-rose-300" : "bg-white/[0.06] text-white/40"
            }`}>
              {count}
            </span>
          )}
          <ChevronDown
            className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
              hasActiveChild ? "text-rose-400" : "text-white/40"
            } ${isOpen ? "" : "-rotate-90"}`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <SidebarMenu className="px-2 gap-0.5">
          {items.map((item) => {
            const active = isActive(item.path);
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  isActive={active}
                  onClick={() => onNavigate(item.path)}
                  tooltip={item.label}
                  className={`h-9 transition-all duration-200 rounded-lg ${
                    active
                      ? "bg-gradient-to-r from-rose-500/20 to-rose-500/5 text-white font-medium shadow-sm shadow-rose-500/10"
                      : "font-normal text-white/60 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  <item.icon className={`h-4 w-4 transition-colors duration-200 ${
                    active ? "text-rose-400" : ""
                  }`} />
                  <span className="text-[13px]">{item.label}</span>
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-rose-400" />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ════════════════════════════════════════════
   Main layout content
   ════════════════════════════════════════════ */
function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const role = (user as any)?.role ?? "consulta";
  const isAdmin = role === "admin";
  const canViewJsm = ["admin", "pmo", "pm", "consulta"].includes(role);
  const visibleAdminMenuItems = isAdmin
    ? adminMenuItems
    : adminMenuItems.filter(item => item.path === "/admin/jsm-spaces");
  const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.consulta;

  const [sections, setSections] = useState<SectionState>(loadSectionState);

  const toggleSection = useCallback((key: keyof SectionState) => {
    setSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /* Keyboard shortcut: Ctrl/Cmd + B */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggleSidebar]);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  /* Resize handle drag */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newW = e.clientX - left;
      if (newW >= MIN_WIDTH && newW <= MAX_WIDTH) setSidebarWidth(newW);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* ── Header ── */}
          <SidebarHeader className="h-16 border-b border-white/[0.06]">
            <div className="flex items-center gap-3 px-2 h-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors shrink-0"
              >
                <PanelLeft className="h-4 w-4 text-white/60" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-10 w-10 rounded-xl ring-1 ring-white/10 overflow-hidden flex items-center justify-center bg-white/5 shrink-0">
                    <img src={LOGO_URL} alt="Prodigio" className="h-8 w-8 object-contain" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-tight text-sidebar-foreground truncate leading-none">
                      Prodigio
                    </p>
                    <p className="text-[11px] font-medium text-white/50 truncate mt-0.5">
                      Prodigio Tech
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* ── Content ── */}
          <SidebarContent className="gap-0 py-3 custom-scrollbar">
            {/* Separator before Principal */}
            <SidebarSection
              title="Principal"
              items={mainMenuItems}
              isOpen={sections.principal}
              onToggle={() => toggleSection("principal")}
              isCollapsed={isCollapsed}
              isActive={isActive}
              onNavigate={setLocation}
              count={mainMenuItems.length}
            />

            {/* Separator */}
            {!isCollapsed && <div className="h-px bg-white/[0.06] mx-4 my-2" />}

            <SidebarSection
              title="Reportes"
              items={reportMenuItems}
              isOpen={sections.reportes}
              onToggle={() => toggleSection("reportes")}
              isCollapsed={isCollapsed}
              isActive={isActive}
              onNavigate={setLocation}
              count={reportMenuItems.length}
            />

            {canViewJsm && (
              <>
                {!isCollapsed && <div className="h-px bg-white/[0.06] mx-4 my-2" />}
                <SidebarSection
                  title="Administración"
                  items={visibleAdminMenuItems}
                  isOpen={sections.admin}
                  onToggle={() => toggleSection("admin")}
                  isCollapsed={isCollapsed}
                  isActive={isActive}
                  onNavigate={setLocation}
                  count={visibleAdminMenuItems.length}
                />
              </>
            )}
          </SidebarContent>

          {/* ── Footer ── */}
          <SidebarFooter className="p-2 border-t border-white/[0.06]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.06] transition-all duration-200 w-full text-left focus:outline-none">
                  <Avatar className="h-9 w-9 shrink-0 ring-2 ring-rose-500/20">
                    <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-rose-500/30 to-rose-600/20 text-rose-200">
                      {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground truncate leading-none">
                        {user?.name ?? "Usuario"}
                      </p>
                      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 ${roleInfo.cls}`}>
                        {roleInfo.label}
                      </span>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold truncate">{user?.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer">
                  <Users className="mr-2 h-4 w-4" />
                  Mi Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* ── Resize handle ── */}
        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-rose-500/20 transition-colors"
            onMouseDown={() => setIsResizing(true)}
            style={{ zIndex: 50 }}
          />
        )}
      </div>

      <SidebarInset>
        {/* ── Mobile header ── */}
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <div className="h-7 w-7 rounded-lg ring-1 ring-white/10 overflow-hidden flex items-center justify-center bg-white/5">
                <img src={LOGO_URL} alt="Prodigio" className="h-5 w-5 object-contain" />
              </div>
              <span className="font-semibold text-sm">Prodigio</span>
            </div>
          </div>
        )}
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </>
  );
}
