"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { sidebarVariants } from "./menu";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/50", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

// asChild hands the actual DOM node to the motion.div below (Radix's Slot merges its own
// role/aria/data-state/focus-trap props onto it) so the dialog box fades+settles in the same way
// NotificationBell's dropdown and UserProfileSidebar's menu do, instead of just snapping into view
// - Radix remounts Content fresh each time the dialog opens, so this entrance animation replays on
// every open without needing AnimatePresence for an exit animation nobody asked for.
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref} asChild {...props}>
      <motion.div
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-md max-h-[85vh] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-[18px] border border-border bg-card p-[26px] text-card-foreground shadow-lg",
          className
        )}
        initial="hidden"
        animate="visible"
        variants={sidebarVariants}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-[26px] top-[26px] cursor-pointer rounded-md border-0 bg-transparent p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:bg-accent">
          <X width={18} height={18} />
          <span className="sr-only">Tutup</span>
        </DialogPrimitive.Close>
      </motion.div>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  // Radix renders Title as a plain <h2> with no styling of its own, but this app skips Tailwind's
  // preflight reset app-wide, so the browser's UA stylesheet default h2 margin (~0.83em) survives
  // and pushes the text down inside DialogHeader - out of line with the close button, which has
  // no such margin. m-0 kills it so the title's line box actually starts where it's positioned.
  <DialogPrimitive.Title ref={ref} className={cn("m-0 text-xl font-bold leading-tight", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
