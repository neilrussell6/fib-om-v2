/** Shared by the server sidebar (reads the cookie) and the client frame (writes it). Not a client module. */
export type SidebarState = "open" | "collapsed";
export const SIDEBAR_COOKIE = "sidebar";
