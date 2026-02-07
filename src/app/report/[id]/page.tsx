import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getReport } from "@/lib/store";
import ReportCard from "./ReportCard";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const report = await getReport(id);
  if (!report)
    return { title: "Report not found — Designlens" };

  return {
    title: `Score ${report.scores.overall}/100 (${report.scores.grade}) — Designlens`,
    description: `Design-system audit for ${report.url}: ${report.scores.overall}/100 overall, ${report.colorSprawl.uniqueCount} colours, ${report.typeSprawl.fontSizes.length} font sizes, ${report.spacingSprawl.allValues.length} spacing values.`,
    openGraph: {
      title: `Designlens — ${report.scores.grade} (${report.scores.overall}/100)`,
      description: `${report.url} — ${report.colorSprawl.uniqueCount} colours, ${report.typeSprawl.fontSizes.length} font sizes, ${report.spacingSprawl.allValues.length} spacing values.`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Designlens — ${report.scores.grade} (${report.scores.overall}/100)`,
      description: `${report.url} — ${report.colorSprawl.uniqueCount} colours, ${report.typeSprawl.fontSizes.length} font sizes, ${report.spacingSprawl.allValues.length} spacing values.`,
    },
  };
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  return <ReportCard report={report} />;
}
