import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";
import { Link, useLocation } from "wouter";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface AppBreadcrumbProps {
  segments: BreadcrumbSegment[];
}

/**
 * Reusable breadcrumb component for all internal pages.
 * Usage:
 *   <AppBreadcrumb segments={[
 *     { label: "PMO Proyectos", href: "/projects" },
 *     { label: "TEST 08", href: "/projects/150001" },
 *     { label: "Elaboración SoW" },
 *   ]} />
 */
export default function AppBreadcrumb({ segments }: AppBreadcrumbProps) {
  if (segments.length === 0) return null;

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {/* Home link always first */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only">Inicio</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <span key={index} className="contents">
              <BreadcrumbSeparator className="text-muted-foreground/40" />
              <BreadcrumbItem>
                {isLast || !segment.href ? (
                  <BreadcrumbPage className="font-medium text-foreground/90 max-w-[200px] truncate">
                    {segment.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      href={segment.href}
                      className="text-muted-foreground hover:text-foreground transition-colors max-w-[200px] truncate"
                    >
                      {segment.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
