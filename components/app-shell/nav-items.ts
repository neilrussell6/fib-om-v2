import {
  Building2,
  FolderTree,
  Layers,
  LayoutDashboard,
  ListOrdered,
  type LucideIcon,
  Package,
  Ruler,
  ShoppingCart,
  Tags,
  Truck,
  UserCog,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };

/** Final sidebar order (spec 01). Later features enable their entries. */
export const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Order Items", href: "/order-items", icon: ListOrdered },
  { label: "Delivery Dockets", href: "/delivery-dockets", icon: Truck },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Product Categories", href: "/product-categories", icon: FolderTree },
  { label: "Product Media", href: "/product-media", icon: Layers },
  { label: "Products", href: "/products", icon: Package },
  { label: "Product Sizes", href: "/product-sizes", icon: Ruler },
  { label: "Product Types", href: "/product-types", icon: Tags },
  { label: "Users", href: "/users", icon: UserCog },
];

/** Screens that exist so far. */
const ENABLED = new Set(["/"]);

export const NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter((item) => ENABLED.has(item.href));
