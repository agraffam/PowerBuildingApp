"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export function SortableWorkoutBlock({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const handle = (
    <button
      type="button"
      className={cn(
        "touch-none rounded-lg p-1.5 text-muted-foreground hover:bg-muted",
        disabled && "pointer-events-none opacity-40",
      )}
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-5" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-60")}>
      {children(handle)}
    </div>
  );
}
