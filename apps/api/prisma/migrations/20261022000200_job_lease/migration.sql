-- CreateTable
CREATE TABLE "job_lease" (
    "name" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_lease_pkey" PRIMARY KEY ("name")
);
