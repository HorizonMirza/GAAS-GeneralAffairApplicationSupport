using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Data;

public static class DatabaseMigrator
{
    private record AtkCatalogSeedItem(string NamaBarang, string Satuan);

    public static void Migrate(AppDbContext db, IConfiguration config)
    {
        var sw = Stopwatch.StartNew();

        // 1. Ensure basic schema is initialized
        db.Database.EnsureCreated();

        // 2. Migration version tracking table
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id VARCHAR(100) PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL
            )");

        var appliedMigrations = db.Database.SqlQueryRaw<string>("SELECT id FROM schema_migrations")
            .ToHashSet();

        const string migration01 = "20261001_01_schema_extensions_and_backfills";
        if (!appliedMigrations.Contains(migration01))
        {
            ApplySchemaExtensionsAndBackfills(db);
            db.Database.ExecuteSqlRaw(
                "INSERT INTO schema_migrations (id, applied_at) VALUES ({0}, {1}) ON CONFLICT DO NOTHING",
                migration01, DateTime.UtcNow);
        }

        // 3. Organization structure seeding & cache load
        SeedAndLoadOrgTree(db);

        // 4. Meeting rooms & Vehicles fleet seeding & cache load
        SeedAndLoadMeetingRoomsAndVehicles(db);

        // 5. Master Data catalog seeding & cache load
        SeedAndLoadMasterData(db);

        // 6. App Settings & Branding seeding & cache load
        SeedAndLoadAppSettings(db, config);

        // 7. Seed system accounts
        DbSeeder.Seed(db);

        sw.Stop();
        Console.WriteLine($"[DatabaseMigrator] Inisialisasi dan migrasi database selesai dalam {sw.ElapsedMilliseconds} ms.");
    }

    private static void ApplySchemaExtensionsAndBackfills(AppDbContext db)
    {
        // Users table enhancements
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS no_hp VARCHAR(50)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS email VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS photo_content_type VARCHAR(100)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS photo_original_filename VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS cover_photo_path VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS cover_photo_content_type VARCHAR(100)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS cover_photo_original_filename VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS cover_preset VARCHAR(50)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE");

        // En-dash backfill
        foreach (var tableCol in new[] { "users", "pengiriman", "booking_ruang", "booking_kendaraan", "permintaan_atk", "perbaikan_sarana" })
        {
            db.Database.ExecuteSqlRaw(
                "UPDATE " + tableCol + " SET departemen = {0} WHERE departemen = {1}",
                "Engineering Project - EPC", "Engineering Project – EPC");
        }

        // Username normalization backfill
        foreach (var (oldUsername, newUsername) in new (string, string)[]
        {
            ("CorporateSecretaryADMINDIV", "Corporate Secretary Admin Div"),
            ("CorporateSecretaryAPPROVALDIV", "Corporate Secretary Approval Div"),
            ("ChiefAuditExecutiveADMINDIV", "Chief Audit Executive Admin Div"),
            ("ChiefAuditExecutiveAPPROVALDIV", "Chief Audit Executive Approval Div"),
            ("QHSSEADMINDIV", "QHSSE Admin Div"),
            ("QHSSEAPPROVALDIV", "QHSSE Approval Div"),
            ("StrategicPlanningADMINDIV", "Strategic Planning Admin Div"),
            ("StrategicPlanningAPPROVALDIV", "Strategic Planning Approval Div"),
            ("EPCCommercialAndEnergyEquipmentADMINDIV", "EPC Commercial and Energy Equipment Admin Div"),
            ("EPCCommercialAndEnergyEquipmentAPPROVALDIV", "EPC Commercial and Energy Equipment Approval Div"),
            ("EPCEngineeringAndQAADMINDIV", "EPC Engineering and QA Admin Div"),
            ("EPCEngineeringAndQAAPPROVALDIV", "EPC Engineering and QA Approval Div"),
            ("EPCProjectADMINDIV", "EPC Project Admin Div"),
            ("EPCProjectAPPROVALDIV", "EPC Project Approval Div"),
            ("JargasProjectADMINDIV", "Jargas Project Admin Div"),
            ("JargasProjectAPPROVALDIV", "Jargas Project Approval Div"),
            ("OperationCommercialServicesADMINDIV", "Operation Commercial Services Admin Div"),
            ("OperationCommercialServicesAPPROVALDIV", "Operation Commercial Services Approval Div"),
            ("OperationEngineeringAndQAADMINDIV", "Operation Engineering and QA Admin Div"),
            ("OperationEngineeringAndQAAPPROVALDIV", "Operation Engineering and QA Approval Div"),
            ("OperationProjectADMINDIV", "Operation Project Admin Div"),
            ("OperationProjectAPPROVALDIV", "Operation Project Approval Div"),
            ("ManufactureAndFabricationADMINDIV", "Manufacture and Fabrication Admin Div"),
            ("ManufactureAndFabricationAPPROVALDIV", "Manufacture and Fabrication Approval Div"),
            ("FinanceADMINDIV", "Finance Admin Div"),
            ("FinanceAPPROVALDIV", "Finance Approval Div"),
            ("ProcurementAndGeneralAffairADMINDIV", "Procurement and General Affair Admin Div"),
            ("ProcurementAndGeneralAffairAPPROVALDIV", "Procurement and General Affair Approval Div"),
            ("InformationAndCommunicationTechnologyADMINDIV", "Information and Communication Technology Admin Div"),
            ("InformationAndCommunicationTechnologyAPPROVALDIV", "Information and Communication Technology Approval Div"),
            ("HumanCapitalManagementADMINDIV", "Human Capital Management Admin Div"),
            ("HumanCapitalManagementAPPROVALDIV", "Human Capital Management Approval Div"),
            ("RiskManagementADMINDIV", "Risk Management Admin Div"),
            ("RiskManagementAPPROVALDIV", "Risk Management Approval Div"),
            ("LegalAndComplianceADMIN", "Legal and Compliance Admin"),
            ("LegalAndComplianceAPPROVAL", "Legal and Compliance Approval"),
            ("CommunicationRelationAndCSRADMIN", "Communication Relation and CSR Admin"),
            ("CommunicationRelationAndCSRAPPROVAL", "Communication Relation and CSR Approval"),
            ("BODBOCSupportADMIN", "BOD/BOC Support Admin"),
            ("BODBOCSupportAPPROVAL", "BOD/BOC Support Approval"),
            ("AuditPlanningAndMonitoringADMIN", "Audit Planning and Monitoring Admin"),
            ("AuditPlanningAndMonitoringAPPROVAL", "Audit Planning and Monitoring Approval"),
            ("InternalAuditorADMIN", "Internal Auditor Admin"),
            ("InternalAuditorAPPROVAL", "Internal Auditor Approval"),
            ("HealthSafetyAndSecurityADMIN", "Health, Safety, and Security Admin"),
            ("HealthSafetyAndSecurityAPPROVAL", "Health, Safety, and Security Approval"),
            ("EnvironmentADMIN", "Environment Admin"),
            ("EnvironmentAPPROVAL", "Environment Approval"),
            ("QualityManagementADMIN", "Quality Management Admin"),
            ("QualityManagementAPPROVAL", "Quality Management Approval"),
            ("BusinessStrategyAndPerformanceMonitoringADMIN", "Business Strategy and Performance Monitoring Admin"),
            ("BusinessStrategyAndPerformanceMonitoringAPPROVAL", "Business Strategy and Performance Monitoring Approval"),
            ("BusinessDevelopmentAndMarketingADMIN", "Business Development and Marketing Admin"),
            ("BusinessDevelopmentAndMarketingAPPROVAL", "Business Development and Marketing Approval"),
            ("EPCSalesAndCustomerRelationADMIN", "EPC Sales and Customer Relation Admin"),
            ("EPCSalesAndCustomerRelationAPPROVAL", "EPC Sales and Customer Relation Approval"),
            ("EPCProjectProposalADMIN", "EPC Project Proposal Admin"),
            ("EPCProjectProposalAPPROVAL", "EPC Project Proposal Approval"),
            ("EnergyEquipmentADMIN", "Energy Equipment Admin"),
            ("EnergyEquipmentAPPROVAL", "Energy Equipment Approval"),
            ("ProposalEngineeringEPCADMIN", "Proposal Engineering - EPC Admin"),
            ("ProposalEngineeringEPCAPPROVAL", "Proposal Engineering - EPC Approval"),
            ("QAEPCADMIN", "QA - EPC Admin"),
            ("QAEPCAPPROVAL", "QA - EPC Approval"),
            ("EngineeringProjectEPCADMIN", "Engineering Project - EPC Admin"),
            ("EngineeringProjectEPCAPPROVAL", "Engineering Project - EPC Approval"),
            ("QHSSEProjectEPCADMIN", "QHSSE Project -EPC Admin"),
            ("QHSSEProjectEPCAPPROVAL", "QHSSE Project -EPC Approval"),
            ("RegionalEPCProjectADMIN", "Regional EPC Project I/II/III Admin"),
            ("RegionalEPCProjectAPPROVAL", "Regional EPC Project I/II/III Approval"),
            ("EPCProjectSupportAndContractManagementADMIN", "EPC Project Support and Contract Management Admin"),
            ("EPCProjectSupportAndContractManagementAPPROVAL", "EPC Project Support and Contract Management Approval"),
            ("ProjectManagerJargasADMIN", "Project Manager - Jargas Admin"),
            ("ProjectManagerJargasAPPROVAL", "Project Manager - Jargas Approval"),
            ("JargasProjectSupportAndContractManagementADMIN", "Jargas Project Support and Contract Management Admin"),
            ("JargasProjectSupportAndContractManagementAPPROVAL", "Jargas Project Support and Contract Management Approval"),
            ("OperationSalesAndCustomerRelationADMIN", "Operation Sales and Customer Relation Admin"),
            ("OperationSalesAndCustomerRelationAPPROVAL", "Operation Sales and Customer Relation Approval"),
            ("OperationProjectProposalADMIN", "Operation Project Proposal Admin"),
            ("OperationProjectProposalAPPROVAL", "Operation Project Proposal Approval"),
            ("ProposalEngineeringOperationADMIN", "Proposal Engineering - Operation Admin"),
            ("ProposalEngineeringOperationAPPROVAL", "Proposal Engineering - Operation Approval"),
            ("QAOperationADMIN", "QA - Operation Admin"),
            ("QAOperationAPPROVAL", "QA - Operation Approval"),
            ("QHSSEProjectOperationADMIN", "QHSSE Project -Operation Admin"),
            ("QHSSEProjectOperationAPPROVAL", "QHSSE Project -Operation Approval"),
            ("ProjectManagerSORADMIN", "Project Manager - SOR I/II/III Admin"),
            ("ProjectManagerSORAPPROVAL", "Project Manager - SOR I/II/III Approval"),
            ("ProjectManagerOMMADMIN", "Project Manager - OMM Admin"),
            ("ProjectManagerOMMAPPROVAL", "Project Manager - OMM Approval"),
            ("ProjectManagerOperationADMIN", "Project Manager - Operation Admin"),
            ("ProjectManagerOperationAPPROVAL", "Project Manager - Operation Approval"),
            ("OperationProjectSupportAndContractManagementADMIN", "Operation Project Support and Contract Management Admin"),
            ("OperationProjectSupportAndContractManagementAPPROVAL", "Operation Project Support and Contract Management Approval"),
            ("ManufactureADMIN", "Manufacture Admin"),
            ("ManufactureAPPROVAL", "Manufacture Approval"),
            ("FabricationADMIN", "Fabrication Admin"),
            ("FabricationAPPROVAL", "Fabrication Approval"),
            ("BudgetingAndAccountingADMIN", "Budgeting and Accounting Admin"),
            ("BudgetingAndAccountingAPPROVAL", "Budgeting and Accounting Approval"),
            ("CashManagementADMIN", "Cash Management Admin"),
            ("CashManagementAPPROVAL", "Cash Management Approval"),
            ("TaxManagementADMIN", "Tax Management Admin"),
            ("TaxManagementAPPROVAL", "Tax Management Approval"),
            ("BadDebtADMIN", "Bad Debt Admin"),
            ("BadDebtAPPROVAL", "Bad Debt Approval"),
            ("ProcurementSystemAndPlanningADMIN", "Procurement System and Planning Admin"),
            ("ProcurementSystemAndPlanningAPPROVAL", "Procurement System and Planning Approval"),
            ("ProcurementOperationalAndContractAdministrationADMIN", "Procurement Operational and Contract Administration Admin"),
            ("ProcurementOperationalAndContractAdministrationAPPROVAL", "Procurement Operational and Contract Administration Approval"),
            ("AssetManagementAndGeneralAffairADMIN", "Asset Management and General Affair Admin"),
            ("AssetManagementAndGeneralAffairAPPROVAL", "Asset Management and General Affair Approval"),
            ("ICTPlanningAndArchitectureADMIN", "ICT Planning and Architecture Admin"),
            ("ICTPlanningAndArchitectureAPPROVAL", "ICT Planning and Architecture Approval"),
            ("ICTDevelopmentADMIN", "ICT Development Admin"),
            ("ICTDevelopmentAPPROVAL", "ICT Development Approval"),
            ("ICTSecurityInfrastructureAndEndUserADMIN", "ICT Security Infrastructure and End User Admin"),
            ("ICTSecurityInfrastructureAndEndUserAPPROVAL", "ICT Security Infrastructure and End User Approval"),
            ("OrganizationAndCultureManagementADMIN", "Organization and Culture Management Admin"),
            ("OrganizationAndCultureManagementAPPROVAL", "Organization and Culture Management Approval"),
            ("CareerAndTalentManagementADMIN", "Career and Talent Management Admin"),
            ("CareerAndTalentManagementAPPROVAL", "Career and Talent Management Approval"),
            ("RewardAndHCServicesADMIN", "Reward and HC Services Admin"),
            ("RewardAndHCServicesAPPROVAL", "Reward and HC Services Approval"),
            ("LearningAndDevelopmentADMIN", "Learning and Development Admin"),
            ("LearningAndDevelopmentAPPROVAL", "Learning and Development Approval"),
            ("RiskManagementADMIN", "Risk Management Admin"),
            ("RiskManagementAPPROVAL", "Risk Management Approval"),
            ("AdminGeneralAffair", "Admin General Affair 1"),
            ("ApprovalGeneralAffair", "Approval General Affair 1"),
            ("SuperAdminGAAS", "Super Admin GAAS"),
        })
        {
            db.Database.ExecuteSqlRaw(
                "UPDATE users SET username = {0} WHERE username = {1} AND NOT EXISTS (SELECT 1 FROM users WHERE username = {0})",
                newUsername, oldUsername);
        }

        // Booking Ruang tables & columns
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS pic VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS no_telepon_pic VARCHAR(50) NOT NULL DEFAULT ''");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS nomor_pemesanan VARCHAR(50)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS tipe VARCHAR(20) NOT NULL DEFAULT 'INTERNAL'");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS series_id UUID");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(20)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS recurrence_end_date DATE");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS has_conflict BOOLEAN NOT NULL DEFAULT FALSE");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS cancelled_by_name VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS cancelled_by_role VARCHAR(50)");

        db.Database.ExecuteSqlRaw(@"
            UPDATE booking_ruang
            SET jam_mulai = '07:00:00', jam_selesai = '18:00:00'
            WHERE is_whole_day = true AND (jam_mulai IS NULL OR jam_selesai IS NULL OR jam_mulai <> '07:00:00' OR jam_selesai <> '18:00:00')
        ");
        db.Database.ExecuteSqlRaw(@"
            UPDATE booking_kendaraan
            SET jam_mulai = '07:00:00', jam_selesai = '18:00:00'
            WHERE is_whole_day = true AND (jam_mulai IS NULL OR jam_selesai IS NULL OR jam_mulai <> '07:00:00' OR jam_selesai <> '18:00:00')
        ");

        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS booking_ruang_rooms (
                id SERIAL PRIMARY KEY,
                booking_ruang_id INT NOT NULL REFERENCES booking_ruang(id) ON DELETE CASCADE,
                nama_ruang VARCHAR(100) NOT NULL
            )");

        db.Database.ExecuteSqlRaw(@"
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'room_booking_counters' AND column_name = 'nama_ruang'
                ) THEN
                    DROP TABLE room_booking_counters;
                END IF;
            END $$;
        ");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS room_booking_counters (
                divisi VARCHAR(255) NOT NULL,
                year INT NOT NULL,
                month INT NOT NULL,
                last_sequence INT NOT NULL,
                PRIMARY KEY (divisi, year, month)
            )");

        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS booking_chat_messages (
                id SERIAL PRIMARY KEY,
                booking_ruang_id INT NOT NULL REFERENCES booking_ruang(id) ON DELETE CASCADE,
                sender_id INT NOT NULL REFERENCES users(id),
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS booking_chat_reads (
                id SERIAL PRIMARY KEY,
                booking_ruang_id INT NOT NULL REFERENCES booking_ruang(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES users(id),
                last_read_at TIMESTAMP NOT NULL,
                UNIQUE (booking_ruang_id, user_id)
            )");

        db.Database.ExecuteSqlRaw("DROP TABLE IF EXISTS booking_waitlist");

        // Invoices indexes & tables
        db.Database.ExecuteSqlRaw(@"
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices')
                    AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_uploaded_by_bulan') THEN
                    BEGIN
                        CREATE UNIQUE INDEX idx_invoices_uploaded_by_bulan ON invoices (uploaded_by, bulan);
                    EXCEPTION WHEN unique_violation THEN
                        NULL;
                    END;
                END IF;
            END $$;
        ");

        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS atk_invoice (
                id SERIAL PRIMARY KEY,
                nama VARCHAR(255) NOT NULL,
                bulan VARCHAR(7) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
                catatan TEXT,
                uploaded_by INT NOT NULL REFERENCES users(id),
                reviewed_by INT REFERENCES users(id),
                uploaded_at TIMESTAMP NOT NULL,
                reviewed_at TIMESTAMP,
                UNIQUE (uploaded_by, bulan)
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS atk_invoice_log (
                id SERIAL PRIMARY KEY,
                atk_invoice_id INT NOT NULL REFERENCES atk_invoice(id) ON DELETE CASCADE,
                action VARCHAR(50) NOT NULL,
                actor_id INT REFERENCES users(id),
                reason TEXT,
                file_path VARCHAR(500),
                original_filename VARCHAR(255),
                created_at TIMESTAMP NOT NULL
            )");

        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS invoice_chat_messages (
                id SERIAL PRIMARY KEY,
                invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                sender_id INT NOT NULL REFERENCES users(id),
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS invoice_chat_reads (
                id SERIAL PRIMARY KEY,
                invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES users(id),
                last_read_at TIMESTAMP NOT NULL,
                UNIQUE (invoice_id, user_id)
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS atk_invoice_chat_messages (
                id SERIAL PRIMARY KEY,
                atk_invoice_id INT NOT NULL REFERENCES atk_invoice(id) ON DELETE CASCADE,
                sender_id INT NOT NULL REFERENCES users(id),
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS atk_invoice_chat_reads (
                id SERIAL PRIMARY KEY,
                atk_invoice_id INT NOT NULL REFERENCES atk_invoice(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES users(id),
                last_read_at TIMESTAMP NOT NULL,
                UNIQUE (atk_invoice_id, user_id)
            )");

        db.Database.ExecuteSqlRaw(@"
            DO $$
            DECLARE
                r RECORD;
                new_seq INT;
            BEGIN
                IF to_regclass('public.pengiriman') IS NOT NULL AND to_regclass('public.divisi_counters') IS NOT NULL THEN
                    FOR r IN SELECT id, tanggal FROM pengiriman WHERE divisi = 'General Affair' ORDER BY tanggal, id LOOP
                        INSERT INTO divisi_counters (divisi, year, month, last_sequence)
                        VALUES ('Procurement and General Affair', EXTRACT(YEAR FROM r.tanggal)::int, EXTRACT(MONTH FROM r.tanggal)::int, 1)
                        ON CONFLICT (divisi, year, month) DO UPDATE SET last_sequence = divisi_counters.last_sequence + 1
                        RETURNING last_sequence INTO new_seq;

                        UPDATE pengiriman
                        SET divisi = 'Procurement and General Affair',
                            departemen = 'Asset Management and General Affair',
                            nomor_transmittal = LPAD(new_seq::text, 4, '0') || '.PGA.' || TO_CHAR(r.tanggal, 'MM') || '.' || TO_CHAR(r.tanggal, 'YYYY')
                        WHERE id = r.id;
                    END LOOP;

                    DELETE FROM divisi_counters WHERE divisi = 'General Affair';
                END IF;
            END $$;
        ");

        // Pengiriman & Booking Ruang indexes
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_pengiriman_status ON pengiriman (status)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_pengiriman_divisi ON pengiriman (divisi)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_pengiriman_departemen ON pengiriman (departemen)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_pengiriman_tanggal ON pengiriman (tanggal)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_ruang_status ON booking_ruang (status)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_ruang_divisi ON booking_ruang (divisi)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_ruang_departemen ON booking_ruang (departemen)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_ruang_tanggal ON booking_ruang (tanggal)");

        db.Database.ExecuteSqlRaw(@"
            UPDATE booking_ruang
            SET reject_reason = 'Ruang sudah dipesan oleh orang yang lebih dulu'
            WHERE reject_reason = 'Ruang sudah dipesan oleh orang yang lebih dulu memesan di jam yang sama';
            UPDATE booking_ruang_logs
            SET reason = 'Ruang sudah dipesan oleh orang yang lebih dulu'
            WHERE reason = 'Ruang sudah dipesan oleh orang yang lebih dulu memesan di jam yang sama';
        ");

        // Vehicle Booking tables & indexes
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS booking_kendaraan (
                id SERIAL PRIMARY KEY,
                nomor_pemesanan VARCHAR(50),
                keperluan VARCHAR(255) NOT NULL,
                pic VARCHAR(255),
                nama_kendaraan VARCHAR(100) NOT NULL,
                plat_nomor VARCHAR(20),
                kapasitas_kendaraan INT NOT NULL,
                supir VARCHAR(255),
                jumlah_penumpang INT NOT NULL,
                tanggal DATE NOT NULL,
                is_whole_day BOOLEAN NOT NULL,
                jam_mulai TIME NULL,
                jam_selesai TIME NULL,
                catatan TEXT,
                divisi VARCHAR(255) NOT NULL,
                departemen VARCHAR(255),
                status VARCHAR(50) NOT NULL,
                reject_reason TEXT,
                created_by INT NOT NULL REFERENCES users(id),
                created_by_role VARCHAR(50) NOT NULL,
                approved_by_l1 INT NULL REFERENCES users(id),
                approved_by_ga INT NULL REFERENCES users(id),
                approved_by_approval_ga INT NULL REFERENCES users(id),
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                approved_l1_at TIMESTAMP NULL,
                approved_ga_at TIMESTAMP NULL,
                approved_approval_ga_at TIMESTAMP NULL
            )");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_kendaraan ADD COLUMN IF NOT EXISTS supir VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_kendaraan ADD COLUMN IF NOT EXISTS no_telepon_pic VARCHAR(50) NOT NULL DEFAULT ''");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_kendaraan ADD COLUMN IF NOT EXISTS cancelled_by_name VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_kendaraan ADD COLUMN IF NOT EXISTS cancelled_by_role VARCHAR(50)");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS booking_kendaraan_logs (
                id SERIAL PRIMARY KEY,
                booking_kendaraan_id INT NOT NULL REFERENCES booking_kendaraan(id) ON DELETE CASCADE,
                action VARCHAR(50) NOT NULL,
                actor_id INT NULL REFERENCES users(id),
                reason TEXT,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS kendaraan_booking_counters (
                divisi VARCHAR(255) NOT NULL,
                year INT NOT NULL,
                month INT NOT NULL,
                last_sequence INT NOT NULL,
                PRIMARY KEY (divisi, year, month)
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS booking_kendaraan_chat_messages (
                id SERIAL PRIMARY KEY,
                booking_kendaraan_id INT NOT NULL REFERENCES booking_kendaraan(id) ON DELETE CASCADE,
                sender_id INT NOT NULL REFERENCES users(id),
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS booking_kendaraan_chat_reads (
                id SERIAL PRIMARY KEY,
                booking_kendaraan_id INT NOT NULL REFERENCES booking_kendaraan(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES users(id),
                last_read_at TIMESTAMP NOT NULL,
                UNIQUE (booking_kendaraan_id, user_id)
            )");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_kendaraan_status ON booking_kendaraan (status)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_kendaraan_divisi ON booking_kendaraan (divisi)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_kendaraan_departemen ON booking_kendaraan (departemen)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_kendaraan_tanggal ON booking_kendaraan (tanggal)");
        db.Database.ExecuteSqlRaw(@"
            UPDATE booking_kendaraan
            SET reject_reason = 'Kendaraan sudah dipesan oleh orang yang lebih dulu'
            WHERE reject_reason = 'Kendaraan sudah dipesan oleh orang yang lebih dulu memesan di jam yang sama';
            UPDATE booking_kendaraan_logs
            SET reason = 'Kendaraan sudah dipesan oleh orang yang lebih dulu'
            WHERE reason = 'Kendaraan sudah dipesan oleh orang yang lebih dulu memesan di jam yang sama';
        ");

        // Permintaan ATK tables & columns
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS permintaan_atk (
                id SERIAL PRIMARY KEY,
                nomor_permintaan VARCHAR(50),
                tanggal DATE NOT NULL,
                keperluan VARCHAR(255) NOT NULL,
                catatan TEXT,
                divisi VARCHAR(255) NOT NULL,
                departemen VARCHAR(255),
                status VARCHAR(50) NOT NULL,
                reject_reason TEXT,
                created_by INT NOT NULL REFERENCES users(id),
                created_by_role VARCHAR(50) NOT NULL,
                approved_by_l1 INT NULL REFERENCES users(id),
                approved_by_ga INT NULL REFERENCES users(id),
                approved_by_approval_ga INT NULL REFERENCES users(id),
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                approved_l1_at TIMESTAMP NULL,
                approved_ga_at TIMESTAMP NULL,
                approved_approval_ga_at TIMESTAMP NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS permintaan_atk_items (
                id SERIAL PRIMARY KEY,
                permintaan_atk_id INT NOT NULL REFERENCES permintaan_atk(id) ON DELETE CASCADE,
                nama_barang VARCHAR(255) NOT NULL,
                jumlah INT NOT NULL,
                satuan VARCHAR(50) NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS permintaan_atk_logs (
                id SERIAL PRIMARY KEY,
                permintaan_atk_id INT NOT NULL REFERENCES permintaan_atk(id) ON DELETE CASCADE,
                action VARCHAR(50) NOT NULL,
                actor_id INT NULL REFERENCES users(id),
                reason TEXT,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS atk_counters (
                divisi VARCHAR(255) NOT NULL,
                year INT NOT NULL,
                month INT NOT NULL,
                last_sequence INT NOT NULL,
                PRIMARY KEY (divisi, year, month)
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS permintaan_atk_chat_messages (
                id SERIAL PRIMARY KEY,
                permintaan_atk_id INT NOT NULL REFERENCES permintaan_atk(id) ON DELETE CASCADE,
                sender_id INT NOT NULL REFERENCES users(id),
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS permintaan_atk_chat_reads (
                id SERIAL PRIMARY KEY,
                permintaan_atk_id INT NOT NULL REFERENCES permintaan_atk(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES users(id),
                last_read_at TIMESTAMP NOT NULL,
                UNIQUE (permintaan_atk_id, user_id)
            )");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_atk ADD COLUMN IF NOT EXISTS approved_by_kpu INT REFERENCES users(id)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_atk ADD COLUMN IF NOT EXISTS approved_kpu_at TIMESTAMP");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_atk ADD COLUMN IF NOT EXISTS sumber_pembelian VARCHAR(20)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_atk ADD COLUMN IF NOT EXISTS total_harga_barang DECIMAL(14,2)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_atk ADD COLUMN IF NOT EXISTS nama_pemohon VARCHAR(255) NOT NULL DEFAULT ''");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_atk ADD COLUMN IF NOT EXISTS no_telepon_pemohon VARCHAR(50) NOT NULL DEFAULT ''");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_atk ADD COLUMN IF NOT EXISTS kategori VARCHAR(50) NOT NULL DEFAULT 'LAINNYA'");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_atk_status ON permintaan_atk (status)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_atk_divisi ON permintaan_atk (divisi)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_atk_departemen ON permintaan_atk (departemen)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_atk_tanggal ON permintaan_atk (tanggal)");

        // Perbaikan Sarana (Maintenance) tables & columns
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS perbaikan_sarana (
                id SERIAL PRIMARY KEY,
                nomor_perbaikan VARCHAR(50),
                tanggal DATE NOT NULL,
                lokasi VARCHAR(255) NOT NULL,
                kategori VARCHAR(50) NOT NULL,
                urgensi VARCHAR(50) NOT NULL,
                deskripsi_kerusakan TEXT NOT NULL,
                catatan TEXT,
                divisi VARCHAR(255) NOT NULL,
                departemen VARCHAR(255),
                status VARCHAR(50) NOT NULL,
                reject_reason TEXT,
                created_by INT NOT NULL REFERENCES users(id),
                created_by_role VARCHAR(50) NOT NULL,
                approved_by_l1 INT NULL REFERENCES users(id),
                approved_by_ga INT NULL REFERENCES users(id),
                approved_by_approval_ga INT NULL REFERENCES users(id),
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                approved_l1_at TIMESTAMP NULL,
                approved_ga_at TIMESTAMP NULL,
                approved_approval_ga_at TIMESTAMP NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS perbaikan_sarana_logs (
                id SERIAL PRIMARY KEY,
                perbaikan_sarana_id INT NOT NULL REFERENCES perbaikan_sarana(id) ON DELETE CASCADE,
                action VARCHAR(50) NOT NULL,
                actor_id INT NULL REFERENCES users(id),
                reason TEXT,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS sarana_counters (
                divisi VARCHAR(255) NOT NULL,
                year INT NOT NULL,
                month INT NOT NULL,
                last_sequence INT NOT NULL,
                PRIMARY KEY (divisi, year, month)
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS perbaikan_sarana_chat_messages (
                id SERIAL PRIMARY KEY,
                perbaikan_sarana_id INT NOT NULL REFERENCES perbaikan_sarana(id) ON DELETE CASCADE,
                sender_id INT NOT NULL REFERENCES users(id),
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS perbaikan_sarana_chat_reads (
                id SERIAL PRIMARY KEY,
                perbaikan_sarana_id INT NOT NULL REFERENCES perbaikan_sarana(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES users(id),
                last_read_at TIMESTAMP NOT NULL,
                UNIQUE (perbaikan_sarana_id, user_id)
            )");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS execution_stage VARCHAR(20) NOT NULL DEFAULT 'MENUNGGU'");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS lokasi_dicek_by INT REFERENCES users(id)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS lokasi_dicek_at TIMESTAMP");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS gambar_dibuat_by INT REFERENCES users(id)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS gambar_dibuat_at TIMESTAMP");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS gambar_file_path VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS gambar_original_filename VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS gambar_content_type VARCHAR(100)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS selesai_by INT REFERENCES users(id)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS selesai_at TIMESTAMP");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS nama_pelapor VARCHAR(255) NOT NULL DEFAULT ''");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS no_telepon_pelapor VARCHAR(50) NOT NULL DEFAULT ''");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS foto_kerusakan_file_path VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS foto_kerusakan_original_filename VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS foto_kerusakan_content_type VARCHAR(100)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS foto_selesai_file_path VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS foto_selesai_original_filename VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ADD COLUMN IF NOT EXISTS foto_selesai_content_type VARCHAR(100)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS perbaikan_sarana ALTER COLUMN urgensi DROP NOT NULL");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS perbaikan_sarana_foto_kerusakan (
                id SERIAL PRIMARY KEY,
                perbaikan_sarana_id INT NOT NULL REFERENCES perbaikan_sarana(id) ON DELETE CASCADE,
                file_path VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                content_type VARCHAR(100) NOT NULL,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_perbaikan_sarana_status ON perbaikan_sarana (status)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_perbaikan_sarana_divisi ON perbaikan_sarana (divisi)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_perbaikan_sarana_departemen ON perbaikan_sarana (departemen)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_perbaikan_sarana_tanggal ON perbaikan_sarana (tanggal)");

        // Permintaan Arsip tables & columns
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS permintaan_arsip (
                id SERIAL PRIMARY KEY,
                nomor_arsip VARCHAR(50),
                tanggal DATE NOT NULL,
                keperluan VARCHAR(255) NOT NULL,
                lokasi_penyimpanan VARCHAR(255) NOT NULL,
                catatan TEXT,
                divisi VARCHAR(255) NOT NULL,
                departemen VARCHAR(255),
                status VARCHAR(50) NOT NULL,
                reject_reason TEXT,
                created_by INT NOT NULL REFERENCES users(id),
                created_by_role VARCHAR(50) NOT NULL,
                approved_by_l1 INT NULL REFERENCES users(id),
                approved_by_ga INT NULL REFERENCES users(id),
                approved_by_approval_ga INT NULL REFERENCES users(id),
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                approved_l1_at TIMESTAMP NULL,
                approved_ga_at TIMESTAMP NULL,
                approved_approval_ga_at TIMESTAMP NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS permintaan_arsip_items (
                id SERIAL PRIMARY KEY,
                permintaan_arsip_id INT NOT NULL REFERENCES permintaan_arsip(id) ON DELETE CASCADE,
                nama_arsip VARCHAR(255) NOT NULL,
                kategori VARCHAR(50) NOT NULL,
                tahun_arsip VARCHAR(20) NOT NULL,
                jumlah INT NOT NULL,
                satuan VARCHAR(50) NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS permintaan_arsip_logs (
                id SERIAL PRIMARY KEY,
                permintaan_arsip_id INT NOT NULL REFERENCES permintaan_arsip(id) ON DELETE CASCADE,
                action VARCHAR(50) NOT NULL,
                actor_id INT NULL REFERENCES users(id),
                reason TEXT,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS arsip_counters (
                divisi VARCHAR(255) NOT NULL,
                year INT NOT NULL,
                month INT NOT NULL,
                last_sequence INT NOT NULL,
                PRIMARY KEY (divisi, year, month)
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS permintaan_arsip_chat_messages (
                id SERIAL PRIMARY KEY,
                permintaan_arsip_id INT NOT NULL REFERENCES permintaan_arsip(id) ON DELETE CASCADE,
                sender_id INT NOT NULL REFERENCES users(id),
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS permintaan_arsip_chat_reads (
                id SERIAL PRIMARY KEY,
                permintaan_arsip_id INT NOT NULL REFERENCES permintaan_arsip(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES users(id),
                last_read_at TIMESTAMP NOT NULL,
                UNIQUE (permintaan_arsip_id, user_id)
            )");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_arsip ADD COLUMN IF NOT EXISTS jumlah_arsip INT NOT NULL DEFAULT 0");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_arsip ADD COLUMN IF NOT EXISTS nama_pic VARCHAR(255)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_arsip ADD COLUMN IF NOT EXISTS no_telepon_pic VARCHAR(50)");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_arsip ADD COLUMN IF NOT EXISTS nama_arsip VARCHAR(255) NOT NULL DEFAULT ''");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_arsip ADD COLUMN IF NOT EXISTS kategori VARCHAR(50) NOT NULL DEFAULT 'LAINNYA'");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_arsip ADD COLUMN IF NOT EXISTS tahun_arsip VARCHAR(20) NOT NULL DEFAULT ''");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_arsip ADD COLUMN IF NOT EXISTS jumlah INT NOT NULL DEFAULT 0");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_arsip ADD COLUMN IF NOT EXISTS satuan VARCHAR(50) NOT NULL DEFAULT ''");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS permintaan_arsip ALTER COLUMN keperluan DROP NOT NULL");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_arsip_status ON permintaan_arsip (status)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_arsip_divisi ON permintaan_arsip (divisi)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_arsip_departemen ON permintaan_arsip (departemen)");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_arsip_tanggal ON permintaan_arsip (tanggal)");

        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS nama VARCHAR(255) NOT NULL DEFAULT ''");

        // Notification sound settings
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS notification_sound_settings (
                id INT PRIMARY KEY,
                chat_sound_id VARCHAR(30) NOT NULL,
                activity_sound_id VARCHAR(30) NOT NULL,
                updated_at TIMESTAMP NOT NULL
            )");
        db.Database.ExecuteSqlRaw(@"
            INSERT INTO notification_sound_settings (id, chat_sound_id, activity_sound_id, updated_at)
            VALUES (1, 'ding', 'pop', NOW())
            ON CONFLICT (id) DO NOTHING");

        // DB-backed organization tables
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS org_direktorat (
                id SERIAL PRIMARY KEY,
                nama VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS org_divisi (
                id SERIAL PRIMARY KEY,
                nama VARCHAR(255) NOT NULL UNIQUE,
                direktorat_id INT NOT NULL REFERENCES org_direktorat(id),
                kode_satuan_kerja VARCHAR(20) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS org_departemen (
                id SERIAL PRIMARY KEY,
                nama VARCHAR(255) NOT NULL UNIQUE,
                divisi_id INT NOT NULL REFERENCES org_divisi(id),
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )");

        // Audit trails
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS deletion_log (
                id SERIAL PRIMARY KEY,
                modul VARCHAR(30) NOT NULL,
                item_id INT NOT NULL,
                item_nomor VARCHAR(100),
                deleted_by INT REFERENCES users(id),
                deleted_by_nama VARCHAR(255) NOT NULL,
                filter_summary TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS admin_activity_log (
                id SERIAL PRIMARY KEY,
                actor_id INT REFERENCES users(id),
                actor_nama VARCHAR(255) NOT NULL,
                action VARCHAR(50) NOT NULL,
                deskripsi TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS impersonation_log (
                id SERIAL PRIMARY KEY,
                super_admin_id INT NOT NULL REFERENCES users(id),
                super_admin_nama VARCHAR(255) NOT NULL,
                target_user_id INT NOT NULL REFERENCES users(id),
                target_nama VARCHAR(255) NOT NULL,
                target_role VARCHAR(50) NOT NULL,
                started_at TIMESTAMP NOT NULL DEFAULT NOW(),
                ended_at TIMESTAMP
            )");

        // Meeting Room & Vehicle tables
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS meeting_room (
                id SERIAL PRIMARY KEY,
                nama VARCHAR(255) NOT NULL UNIQUE,
                kapasitas INT NOT NULL,
                lantai VARCHAR(50) NOT NULL,
                fasilitas_csv TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS vehicle (
                id SERIAL PRIMARY KEY,
                nama VARCHAR(255) NOT NULL UNIQUE,
                plat_nomor VARCHAR(20) NOT NULL,
                kapasitas INT NOT NULL,
                supir VARCHAR(255) NOT NULL,
                merek VARCHAR(100) NOT NULL,
                model VARCHAR(100) NOT NULL,
                tahun INT NOT NULL,
                warna VARCHAR(50) NOT NULL,
                nomor_telepon_supir VARCHAR(30) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )");
        db.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS vehicle DROP COLUMN IF EXISTS lokasi_parkir");

        // Master Data table
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS master_data_item (
                id SERIAL PRIMARY KEY,
                category VARCHAR(50) NOT NULL,
                key VARCHAR(150) NOT NULL,
                label VARCHAR(255) NOT NULL,
                extra VARCHAR(50),
                sort_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE (category, key)
            )");

        // App Settings & Holiday tables
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS app_settings (
                id SERIAL PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL,
                logo_path VARCHAR(255),
                logo_content_type VARCHAR(50),
                logo_original_filename VARCHAR(255),
                operating_start TIME NOT NULL,
                operating_end TIME NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS holiday (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL UNIQUE,
                label VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )");
    }

    private static void SeedAndLoadOrgTree(AppDbContext db)
    {
        if (!db.OrgDirektorats.Any())
        {
            foreach (var direktorat in OrgTree.SeedData)
            {
                var direktoratRow = new OrgDirektorat { Nama = direktorat.Nama };
                db.OrgDirektorats.Add(direktoratRow);
                db.SaveChanges();

                foreach (var divisi in direktorat.Divisi)
                {
                    var divisiRow = new OrgDivisi
                    {
                        Nama = divisi.Nama,
                        DirektoratId = direktoratRow.Id,
                        KodeSatuanKerja = OrgTree.SeedKodeSatuanKerjaByDivisi.TryGetValue(divisi.Nama, out var kode) ? kode : "GA",
                    };
                    db.OrgDivisis.Add(divisiRow);
                    db.SaveChanges();

                    foreach (var departemen in divisi.Departemen)
                    {
                        db.OrgDepartemens.Add(new OrgDepartemen { Nama = departemen.Nama, DivisiId = divisiRow.Id });
                    }
                    db.SaveChanges();
                }
            }
        }

        OrgTree.LoadFromDb(db);
    }

    private static void SeedAndLoadMeetingRoomsAndVehicles(AppDbContext db)
    {
        if (!db.MeetingRooms.Any())
        {
            foreach (var room in MeetingRooms.SeedData)
            {
                db.MeetingRooms.Add(new MeetingRoom
                {
                    Nama = room.Nama,
                    Kapasitas = room.Kapasitas,
                    Lantai = room.Lantai,
                    FasilitasCsv = string.Join(",", room.Fasilitas),
                });
            }
            db.SaveChanges();
        }

        if (!db.Vehicles.Any())
        {
            foreach (var vehicle in Vehicles.SeedData)
            {
                db.Vehicles.Add(new Vehicle
                {
                    Nama = vehicle.Nama,
                    PlatNomor = vehicle.PlatNomor,
                    Kapasitas = vehicle.Kapasitas,
                    Supir = vehicle.Supir,
                    Merek = vehicle.Merek,
                    Model = vehicle.Model,
                    Tahun = vehicle.Tahun,
                    Warna = vehicle.Warna,
                    NomorTeleponSupir = vehicle.NomorTeleponSupir,
                });
            }
            db.SaveChanges();
        }

        MeetingRooms.LoadFromDb(db);
        Vehicles.LoadFromDb(db);
    }

    private static void SeedAndLoadMasterData(AppDbContext db)
    {
        if (!db.MasterDataItems.Any())
        {
            var order = 0;
            void Seed(string category, string key, string label, string? extra = null)
            {
                db.MasterDataItems.Add(new MasterDataItem
                {
                    Category = category, Key = key, Label = label, Extra = extra, SortOrder = order++,
                });
            }

            Seed(MasterDataCategories.Asuransi, "Ya", "Ya");
            Seed(MasterDataCategories.Asuransi, "Tidak", "Tidak");

            order = 0;
            Seed(MasterDataCategories.Pengemasan, "Tidak", "Tidak");
            Seed(MasterDataCategories.Pengemasan, "Tambahan Kayu", "Tambahan Kayu");

            order = 0;
            Seed(MasterDataCategories.TipeBooking, "INTERNAL", "Internal");
            Seed(MasterDataCategories.TipeBooking, "EXTERNAL", "External");

            order = 0;
            Seed(MasterDataCategories.AtkKategori, "ELEKTRONIK_KOMPUTER", "Elektronik & Komputer");
            Seed(MasterDataCategories.AtkKategori, "KEBERSIHAN_PANTRY", "Kebersihan & Pantry");
            Seed(MasterDataCategories.AtkKategori, "PERLENGKAPAN_KANTOR", "Perlengkapan Kantor");
            Seed(MasterDataCategories.AtkKategori, "PERLENGKAPAN_RAPAT", "Perlengkapan Rapat");
            Seed(MasterDataCategories.AtkKategori, "KERTAS_CETAK", "Kertas & Cetak");
            Seed(MasterDataCategories.AtkKategori, "MAP_FILING", "Map & Filing");
            Seed(MasterDataCategories.AtkKategori, "ALAT_TULIS", "Alat Tulis");
            Seed(MasterDataCategories.AtkKategori, "LAINNYA", "Lainnya");

            order = 0;
            Seed(MasterDataCategories.KategoriKerusakan, "AC", "Pendingin Ruangan");
            Seed(MasterDataCategories.KategoriKerusakan, "FURNITUR", "Furnitur");
            Seed(MasterDataCategories.KategoriKerusakan, "GEDUNG", "Bangunan");
            Seed(MasterDataCategories.KategoriKerusakan, "IT", "Jaringan");
            Seed(MasterDataCategories.KategoriKerusakan, "LISTRIK", "Listrik");
            Seed(MasterDataCategories.KategoriKerusakan, "AIR", "Saluran");
            Seed(MasterDataCategories.KategoriKerusakan, "LAINNYA", "Lainnya");

            order = 0;
            Seed(MasterDataCategories.ArchiveKategori, "SOP", "SOP");
            Seed(MasterDataCategories.ArchiveKategori, "SURAT", "Surat");
            Seed(MasterDataCategories.ArchiveKategori, "KONTRAK", "Kontrak");
            Seed(MasterDataCategories.ArchiveKategori, "LAPORAN", "Laporan");
            Seed(MasterDataCategories.ArchiveKategori, "PANDUAN", "Panduan");
            Seed(MasterDataCategories.ArchiveKategori, "LAINNYA", "Lainnya");

            order = 0;
            var catalogPath = Path.Combine(AppContext.BaseDirectory, "SeedData", "atk_nama_barang.json");
            if (File.Exists(catalogPath))
            {
                var catalogJson = File.ReadAllText(catalogPath);
                var catalogItems = JsonSerializer.Deserialize<List<AtkCatalogSeedItem>>(catalogJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
                foreach (var item in catalogItems)
                    Seed(MasterDataCategories.AtkNamaBarang, item.NamaBarang, item.NamaBarang, item.Satuan);
            }

            order = 0;
            var currentYear = DateTime.UtcNow.Year;
            for (var year = currentYear - 15; year <= currentYear + 1; year++)
                Seed(MasterDataCategories.ArsipTahun, year.ToString(), year.ToString());

            db.SaveChanges();
        }

        MasterData.LoadFromDb(db);
    }

    private static void SeedAndLoadAppSettings(AppDbContext db, IConfiguration config)
    {
        if (!db.AppSettings.Any())
        {
            db.AppSettings.Add(new AppSettings
            {
                Id = 1,
                CompanyName = "PGN Solution",
                OperatingStart = new TimeOnly(7, 0),
                OperatingEnd = new TimeOnly(18, 0),
                UpdatedAt = DateTime.UtcNow,
            });
            db.SaveChanges();
        }

        AppSettingsCache.Configure(DirektoriUnggahan.ResolveDanBuat(config, DirektoriUnggahan.KunciAppLogo, DirektoriUnggahan.DefaultAppLogo));
        AppSettingsCache.LoadFromDb(db);
    }
}
