"use client";

import { motion } from "framer-motion";
import { Download, Eye, FileText, ListChecks, SquarePen, Trash2 } from "lucide-react";
import { itemVariants, sidebarVariants } from "./ui/menu";

interface Props {
  position: { top: number; left: number } | null;
  showUpdates: boolean;
  showDelete: boolean;
  pdfViewUrl: string;
  pdfDownloadUrl: string;
  onDetail: () => void;
  onUpdates: () => void;
  onRiwayat: () => void;
  onDelete: () => void;
  onLinkClick: () => void;
}

export default function InvoiceRowMenuDropdown({
  position,
  showUpdates,
  showDelete,
  pdfViewUrl,
  pdfDownloadUrl,
  onDetail,
  onUpdates,
  onRiwayat,
  onDelete,
  onLinkClick,
}: Props) {
  if (!position) return null;
  return (
    <motion.div
      className="row-menu-dropdown"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
      initial="hidden"
      animate="visible"
      variants={sidebarVariants}
    >
      <motion.div variants={itemVariants}>
        <button type="button" className="row-menu-item" onClick={onDetail}>
          <ListChecks width={16} height={16} />
          Detail
        </button>
      </motion.div>
      {showUpdates && (
        <motion.div variants={itemVariants}>
          <button type="button" className="row-menu-item" onClick={onUpdates}>
            <SquarePen width={16} height={16} />
            Updates
          </button>
        </motion.div>
      )}
      <motion.div variants={itemVariants}>
        <button type="button" className="row-menu-item" onClick={onRiwayat}>
          <FileText width={16} height={16} />
          History
        </button>
      </motion.div>
      <motion.div variants={itemVariants}>
        <a className="row-menu-item" href={pdfViewUrl} target="_blank" rel="noopener noreferrer" onClick={onLinkClick}>
          <Eye width={16} height={16} />
          Lihat PDF
        </a>
      </motion.div>
      <motion.div variants={itemVariants}>
        <a className="row-menu-item" href={pdfDownloadUrl} onClick={onLinkClick}>
          <Download width={16} height={16} />
          Download PDF
        </a>
      </motion.div>
      {showDelete && (
        <motion.div variants={itemVariants}>
          <button type="button" className="row-menu-item row-menu-item-danger" onClick={onDelete}>
            <Trash2 width={16} height={16} />
            Delete
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
