import { ToolsSidebar } from "../components/tools-sidebar";

export default function ToolsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F6F2EA] text-[#102016] lg:flex-row">
      <ToolsSidebar />
      <main className="flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</main>
    </div>
  );
}
