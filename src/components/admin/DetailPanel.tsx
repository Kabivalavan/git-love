import { ReactNode } from 'react';
import { X, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteConfirmMessage?: string;
  isDeleting?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function DetailPanel({
  isOpen,
  onClose,
  title,
  children,
  onEdit,
  onDelete,
  deleteConfirmMessage = 'Are you sure you want to delete this item? This action cannot be undone.',
  isDeleting = false,
  canEdit = true,
  canDelete = true,
}: DetailPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Centered Panel */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className={cn(
            "w-full max-w-2xl max-h-[90vh] bg-card rounded-lg border border-border shadow-xl",
            "transform transition-all duration-300 ease-in-out overflow-hidden flex flex-col",
            isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <div className="flex items-center gap-2">
              {onEdit && canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onEdit}
                  className="opacity-60 hover:opacity-100"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-60 hover:opacity-100 hover:text-destructive"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Item</AlertDialogTitle>
                      <AlertDialogDescription>
                        {deleteConfirmMessage}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

// Detail field component for consistent styling
interface DetailFieldProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function DetailField({ label, value, className }: DetailFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm text-foreground">{value ?? '-'}</p>
    </div>
  );
}

// Detail section for grouping fields
interface DetailSectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function DetailSection({ title, children, className }: DetailSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {title && (
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
          {title}
        </h3>
      )}
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}
