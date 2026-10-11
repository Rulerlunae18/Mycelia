-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maps` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `theme` VARCHAR(191) NOT NULL DEFAULT 'default',
    `layout` VARCHAR(191) NOT NULL DEFAULT 'radial',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `maps_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Node` (
    `id` VARCHAR(191) NOT NULL,
    `mapId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `text` TEXT NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `collapsed` BOOLEAN NOT NULL DEFAULT false,
    `style` JSON NULL,
    `category` VARCHAR(191) NULL,
    `priority` VARCHAR(191) NULL,

    INDEX `Node_mapId_idx`(`mapId`),
    INDEX `Node_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attachment` (
    `id` VARCHAR(191) NOT NULL,
    `nodeId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Attachment_nodeId_idx`(`nodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Boundary` (
    `id` VARCHAR(191) NOT NULL,
    `mapId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `nodeIds` JSON NOT NULL,

    INDEX `Boundary_mapId_idx`(`mapId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Template` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `treeSnapshot` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `maps` ADD CONSTRAINT `maps_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Node` ADD CONSTRAINT `Node_mapId_fkey` FOREIGN KEY (`mapId`) REFERENCES `maps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Node` ADD CONSTRAINT `Node_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Node`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_nodeId_fkey` FOREIGN KEY (`nodeId`) REFERENCES `Node`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Boundary` ADD CONSTRAINT `Boundary_mapId_fkey` FOREIGN KEY (`mapId`) REFERENCES `maps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
