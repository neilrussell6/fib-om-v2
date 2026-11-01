import {
  Building2,
  Layers,
  LayoutGrid,
  ListOrdered,
  ListTree,
  type LucideIcon,
  Package,
  Ruler,
  ShoppingCart,
  Tags,
  Truck,
  Users,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

/** The design's grouped sidebar (spec 06), with its Lucide icons. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutGrid },
      { label: "Orders", href: "/orders", icon: ShoppingCart },
      { label: "Order Items", href: "/order-items", icon: ListOrdered },
      { label: "Delivery Dockets", href: "/delivery-dockets", icon: Truck },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { label: "Products", href: "/products", icon: Package },
      { label: "Product Categories", href: "/product-categories", icon: ListTree },
      { label: "Product Types", href: "/product-types", icon: Tags },
      { label: "Product Sizes", href: "/product-sizes", icon: Ruler },
      { label: "Product Media", href: "/product-media", icon: Layers },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Clients", href: "/clients", icon: Building2 },
      { label: "Users", href: "/users", icon: Users },
    ],
  },
];

/** Every entry, in sidebar order. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
