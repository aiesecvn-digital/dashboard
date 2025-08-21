import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",   // Bắt buộc để export static
  images: {
    unoptimized: true // Nếu có dùng <Image />, bắt buộc để tránh lỗi
  },
  basePath: "/dashboard", 
  assetPrefix: "/dashboard/",
};

module.exports = nextConfig;