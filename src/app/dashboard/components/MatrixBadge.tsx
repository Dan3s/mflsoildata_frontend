import { matrixBadgeClass } from "@/app/lib/matrixColors";

/** Small colored pill for a matrix value, using the shared per-matrix color map. */
export default function MatrixBadge({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${matrixBadgeClass(value)} ${className}`}>
      {value}
    </span>
  );
}
