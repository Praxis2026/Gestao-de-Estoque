-- Update prosthetic service items table to include value
ALTER TABLE "prosthetic_service_items" ADD COLUMN "valor" DECIMAL(10,2) DEFAULT 0;
