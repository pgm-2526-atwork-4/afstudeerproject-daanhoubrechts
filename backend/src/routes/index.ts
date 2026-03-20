import { Router } from "express";
import { profileRoutes } from "./profiles.js";
import { authRoutes } from "./auth.js";
import { kotgroepenRoutes } from "./kotgroepen.js";
import { invitesRoutes } from "./invites.js";
import { postsRoutes } from "./posts.js";
import { issuesRoutes } from "./issues.js";
import { todosRoutes } from "./todos.js";
import { kotkasRoutes } from "./kotkas.js";

export const routes = Router();

routes.use("/auth", authRoutes);
routes.use("/profiles", profileRoutes);
routes.use("/kotgroepen", kotgroepenRoutes);
routes.use("/invites", invitesRoutes);
routes.use("/posts", postsRoutes);
routes.use("/issues", issuesRoutes);
routes.use("/todos", todosRoutes);
routes.use("/kotkas", kotkasRoutes);
