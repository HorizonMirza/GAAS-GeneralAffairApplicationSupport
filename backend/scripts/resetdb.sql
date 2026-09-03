-- Wipes every transaction/data table across all modules (Ekspedisi, Invoice, Room Booking,
-- Vehicle Booking, Office Supplies/ATK, Maintenance/Perbaikan Sarana, Archive/Arsip) while
-- leaving "users" untouched, so all seeded accounts (and any accounts you created) survive.
-- RESTART IDENTITY resets every auto-increment id/counter back to 1, so new records after
-- this runs will start numbering from scratch again.
--
-- Run: psql -h <host> -p <port> -U <user> -d <database> -f resetdb.sql

TRUNCATE TABLE
    -- Ekspedisi (shipment) + its chat + Invoice submodule
    pengiriman,
    pengiriman_logs,
    chat_messages,
    chat_reads,
    invoices,
    invoice_logs,

    -- Room Booking
    booking_ruang,
    booking_ruang_rooms,
    booking_ruang_logs,
    booking_chat_messages,
    booking_chat_reads,
    room_booking_counters,
    booking_waitlist,

    -- Vehicle Booking
    booking_kendaraan,
    booking_kendaraan_logs,
    kendaraan_booking_counters,
    booking_kendaraan_chat_messages,
    booking_kendaraan_chat_reads,

    -- Office Supplies (ATK)
    permintaan_atk,
    permintaan_atk_items,
    permintaan_atk_logs,
    atk_counters,
    permintaan_atk_chat_messages,
    permintaan_atk_chat_reads,

    -- Maintenance (Perbaikan Sarana)
    perbaikan_sarana,
    perbaikan_sarana_logs,
    sarana_counters,
    perbaikan_sarana_chat_messages,
    perbaikan_sarana_chat_reads,

    -- Archive (Arsip)
    permintaan_arsip,
    permintaan_arsip_items,
    permintaan_arsip_logs,
    arsip_counters,
    permintaan_arsip_chat_messages,
    permintaan_arsip_chat_reads,

    -- shared per-Divisi transmittal/document counter
    divisi_counters
RESTART IDENTITY CASCADE;
