INSERT INTO "Tenant" ("id", "name", "createdAt", "updatedAt") VALUES ('tenant-1', 'Valurion Inc.', NOW(), NOW()) ON CONFLICT DO NOTHING;
INSERT INTO "User" ("id", "email", "passwordHash", "role", "tenantId", "createdAt", "updatedAt") VALUES ('user-1', 'admin@valurion.com', '$2b$10$Jq822HVS5H5FHW9jVPoovuc5Nyjckp8vwAFRtuzCqs6cvFk3DDY12', 'ADMIN', 'tenant-1', NOW(), NOW()) ON CONFLICT DO NOTHING;
