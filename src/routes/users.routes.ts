import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateParams, validateQuery, getQuery, getParams } from "../middleware/validate";
import { ok, paginated, noContent } from "../utils/responses";
import * as userService from "../services/user.service";
import type { ListUsersQuery, CreateUserInput, UpdateUserInput } from "../validators/user.schema";
import * as validators from "../validators/user.schema";

const router = Router();

router.get("/", requireAuth, requireRole("ENCARGADO"), validateQuery(validators.listUsersQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<ListUsersQuery>(req);
    const result = await userService.listUsers(query);
    paginated(res, result.items, result.meta);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const user = await userService.getUser(id);
    ok(res, { user }, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validateBody(validators.createUserSchema), async (req, res, next) => {
  try {
    const body = getBody<CreateUserInput>(req);
    const user = await userService.createUser(body);
    ok(res, { user }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), validateBody(validators.updateUserSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const body = getBody<UpdateUserInput>(req);
    const user = await userService.updateUser(id, body, { keepSessionId: req.user!.sid });
    ok(res, { user }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    await userService.deleteUser(id, req.user!.id);
    noContent(res);
  } catch (e) {
    next(e);
  }
});

function getBody<T>(req: import("express").Request): T {
  return req.validated?.body as T;
}

export default router;