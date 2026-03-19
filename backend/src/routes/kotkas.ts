import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const kotkasRoutes = Router();

async function checkMembership(
  userId: string,
  kotgroupId: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("kotgroup_members")
    .select("kotgroup_id")
    .eq("user_id", userId)
    .eq("kotgroup_id", kotgroupId)
    .maybeSingle();
  return !!data;
}

// uitgaven ophalen voor een kotgroep
kotkasRoutes.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const kotgroupId = req.query["kotgroupId"] as string | undefined;

    if (!kotgroupId) {
      res.status(400).json({ error: "kotgroupId is verplicht." });
      return;
    }

    if (!(await checkMembership(userId, kotgroupId))) {
      res.status(403).json({ error: "Geen toegang tot deze kotgroep." });
      return;
    }

    const { data: expenses, error } = await supabaseAdmin
      .from("expenses")
      .select("id, kotgroup_id, paid_by, title, amount, created_at, updated_at")
      .eq("kotgroup_id", kotgroupId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!expenses || expenses.length === 0) {
      res.json([]);
      return;
    }

    const expenseIds = expenses.map((e) => e.id);

    const { data: participantRows, error: partError } = await supabaseAdmin
      .from("expense_participants")
      .select("expense_id, user_id")
      .in("expense_id", expenseIds);

    if (partError) {
      res.status(500).json({ error: partError.message });
      return;
    }

    const allPayerIds = [...new Set(expenses.map((e) => e.paid_by))];
    const allParticipantIds = [
      ...new Set((participantRows ?? []).map((p) => p.user_id)),
    ];
    const allUserIds = [...new Set([...allPayerIds, ...allParticipantIds])];

    let profileMap: Record<
      string,
      {
        id: string;
        first_name: string;
        last_name: string;
        avatar_url: string | null;
      }
    > = {};

    if (allUserIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", allUserIds);

      for (const p of profiles ?? []) {
        profileMap[p.id] = p;
      }
    }

    const result = expenses.map((expense) => {
      const participants = (participantRows ?? [])
        .filter((p) => p.expense_id === expense.id)
        .map((p) => profileMap[p.user_id])
        .filter(Boolean);

      return {
        ...expense,
        payer: profileMap[expense.paid_by] ?? null,
        participants,
      };
    });

    res.json(result);
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// balansen berekenen
kotkasRoutes.get("/balances", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const kotgroupId = req.query["kotgroupId"] as string | undefined;

    if (!kotgroupId) {
      res.status(400).json({ error: "kotgroupId is verplicht." });
      return;
    }

    if (!(await checkMembership(userId, kotgroupId))) {
      res.status(403).json({ error: "Geen toegang tot deze kotgroep." });
      return;
    }

    const { data: expenses } = await supabaseAdmin
      .from("expenses")
      .select("id, paid_by, amount")
      .eq("kotgroup_id", kotgroupId);

    if (!expenses || expenses.length === 0) {
      // leden ophalen zodat we iedereen op 0 kunnen tonen
      const { data: memberRows } = await supabaseAdmin
        .from("kotgroup_members")
        .select("user_id")
        .eq("kotgroup_id", kotgroupId);

      const memberIds = (memberRows ?? []).map((m) => m.user_id);
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", memberIds);

      const balances = (profiles ?? []).map((p) => ({
        userId: p.id,
        name: `${p.first_name} ${p.last_name}`.trim(),
        avatar_url: p.avatar_url,
        netBalance: 0,
      }));

      res.json({ balances, settlements: [] });
      return;
    }

    const expenseIds = expenses.map((e) => e.id);

    const { data: participantRows } = await supabaseAdmin
      .from("expense_participants")
      .select("expense_id, user_id")
      .in("expense_id", expenseIds);

    // stap 1: netto balans per persoon berekenen
    const netBalanceMap: Record<string, number> = {};

    for (const expense of expenses) {
      const participants = (participantRows ?? []).filter(
        (p) => p.expense_id === expense.id,
      );
      const count = participants.length;
      if (count === 0) continue;

      const share = expense.amount / count;

      // betaler krijgt credit voor het volledige bedrag
      netBalanceMap[expense.paid_by] =
        (netBalanceMap[expense.paid_by] ?? 0) + expense.amount;

      // elke deelnemer krijgt een schuld van zijn aandeel
      for (const p of participants) {
        netBalanceMap[p.user_id] = (netBalanceMap[p.user_id] ?? 0) - share;
      }
    }

    // profielen ophalen voor alle betrokken users
    const allUserIds = Object.keys(netBalanceMap);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", allUserIds);

    const profileMap: Record<
      string,
      {
        id: string;
        first_name: string;
        last_name: string;
        avatar_url: string | null;
      }
    > = {};
    for (const p of profiles ?? []) {
      profileMap[p.id] = p;
    }

    const balances = allUserIds.map((uid) => ({
      userId: uid,
      name: profileMap[uid]
        ? `${profileMap[uid].first_name} ${profileMap[uid].last_name}`.trim()
        : uid,
      avatar_url: profileMap[uid]?.avatar_url ?? null,
      netBalance: Math.round((netBalanceMap[uid] ?? 0) * 100) / 100,
    }));

    // stap 2: schulden vereenvoudigen via greedy matching
    // crediteuren = positief saldo, debiteuren = negatief saldo
    const creditors = balances
      .filter((b) => b.netBalance > 0.005)
      .map((b) => ({ userId: b.userId, name: b.name, amount: b.netBalance }))
      .sort((a, b) => b.amount - a.amount);

    const debtors = balances
      .filter((b) => b.netBalance < -0.005)
      .map((b) => ({
        userId: b.userId,
        name: b.name,
        amount: Math.abs(b.netBalance),
      }))
      .sort((a, b) => b.amount - a.amount);

    const settlements: {
      from: string;
      fromName: string;
      to: string;
      toName: string;
      amount: number;
    }[] = [];

    let ci = 0;
    let di = 0;

    while (ci < creditors.length && di < debtors.length) {
      const creditor = creditors[ci];
      const debtor = debtors[di];

      const payment = Math.min(debtor.amount, creditor.amount);
      const rounded = Math.round(payment * 100) / 100;

      if (rounded > 0) {
        settlements.push({
          from: debtor.userId,
          fromName: debtor.name,
          to: creditor.userId,
          toName: creditor.name,
          amount: rounded,
        });
      }

      creditor.amount = Math.round((creditor.amount - payment) * 100) / 100;
      debtor.amount = Math.round((debtor.amount - payment) * 100) / 100;

      if (creditor.amount < 0.005) ci++;
      if (debtor.amount < 0.005) di++;
    }

    res.json({ balances, settlements });
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// nieuwe uitgave aanmaken
kotkasRoutes.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { kotgroup_id, title, amount, paid_by, participant_ids } =
      req.body as {
        kotgroup_id?: string;
        title?: string;
        amount?: number;
        paid_by?: string;
        participant_ids?: string[];
      };

    if (!kotgroup_id || !title?.trim() || !amount || !paid_by) {
      res
        .status(400)
        .json({
          error: "kotgroup_id, title, amount en paid_by zijn verplicht.",
        });
      return;
    }

    if (!(await checkMembership(userId, kotgroup_id))) {
      res.status(403).json({ error: "Geen toegang tot deze kotgroep." });
      return;
    }

    const { data: expense, error } = await supabaseAdmin
      .from("expenses")
      .insert({ kotgroup_id, paid_by, title: title.trim(), amount })
      .select("id, kotgroup_id, paid_by, title, amount, created_at, updated_at")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const ids =
      participant_ids && participant_ids.length > 0
        ? participant_ids
        : [paid_by];
    const rows = ids.map((uid) => ({ expense_id: expense.id, user_id: uid }));
    await supabaseAdmin.from("expense_participants").insert(rows);

    const { data: participantRows } = await supabaseAdmin
      .from("expense_participants")
      .select("user_id")
      .eq("expense_id", expense.id);

    const participantUserIds = (participantRows ?? []).map((p) => p.user_id);
    const allIds = [...new Set([expense.paid_by, ...participantUserIds])];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", allIds);

    const profileMap: Record<
      string,
      {
        id: string;
        first_name: string;
        last_name: string;
        avatar_url: string | null;
      }
    > = {};
    for (const p of profiles ?? []) {
      profileMap[p.id] = p;
    }

    res.status(201).json({
      ...expense,
      payer: profileMap[expense.paid_by] ?? null,
      participants: participantUserIds
        .map((uid) => profileMap[uid])
        .filter(Boolean),
    });
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// uitgave updaten (enkel payer of kotbaas)
kotkasRoutes.patch("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const expenseId = req.params["id"];

    const { data: expense, error: expenseError } = await supabaseAdmin
      .from("expenses")
      .select("id, kotgroup_id, paid_by, title, amount, created_at, updated_at")
      .eq("id", expenseId)
      .single();

    if (expenseError || !expense) {
      res.status(404).json({ error: "Uitgave niet gevonden." });
      return;
    }

    const { data: memberRow } = await supabaseAdmin
      .from("kotgroup_members")
      .select("kotgroup_id")
      .eq("user_id", userId)
      .eq("kotgroup_id", expense.kotgroup_id)
      .maybeSingle();

    if (!memberRow) {
      res.status(403).json({ error: "Geen toegang." });
      return;
    }

    const { title, amount, paid_by, participant_ids } = req.body as {
      title?: string;
      amount?: number;
      paid_by?: string;
      participant_ids?: string[];
    };

    const update: Record<string, unknown> = {};
    if (title !== undefined) update["title"] = title.trim();
    if (amount !== undefined) update["amount"] = amount;
    if (paid_by !== undefined) update["paid_by"] = paid_by;
    update["updated_at"] = new Date().toISOString();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("expenses")
      .update(update)
      .eq("id", expenseId)
      .select("id, kotgroup_id, paid_by, title, amount, created_at, updated_at")
      .single();

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    if (participant_ids !== undefined) {
      await supabaseAdmin
        .from("expense_participants")
        .delete()
        .eq("expense_id", expenseId);
      const ids =
        participant_ids.length > 0 ? participant_ids : [updated.paid_by];
      const rows = ids.map((uid) => ({ expense_id: expenseId, user_id: uid }));
      await supabaseAdmin.from("expense_participants").insert(rows);
    }

    const { data: participantRows } = await supabaseAdmin
      .from("expense_participants")
      .select("user_id")
      .eq("expense_id", expenseId);

    const participantUserIds = (participantRows ?? []).map((p) => p.user_id);
    const allIds = [...new Set([updated.paid_by, ...participantUserIds])];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", allIds);

    const profileMap: Record<
      string,
      {
        id: string;
        first_name: string;
        last_name: string;
        avatar_url: string | null;
      }
    > = {};
    for (const p of profiles ?? []) {
      profileMap[p.id] = p;
    }

    res.json({
      ...updated,
      payer: profileMap[updated.paid_by] ?? null,
      participants: participantUserIds
        .map((uid) => profileMap[uid])
        .filter(Boolean),
    });
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// uitgave verwijderen (enkel payer of kotbaas)
kotkasRoutes.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const expenseId = req.params["id"];

    const { data: expense, error: expenseError } = await supabaseAdmin
      .from("expenses")
      .select("id, kotgroup_id, paid_by")
      .eq("id", expenseId)
      .single();

    if (expenseError || !expense) {
      res.status(404).json({ error: "Uitgave niet gevonden." });
      return;
    }

    const { data: memberRow } = await supabaseAdmin
      .from("kotgroup_members")
      .select("kotgroup_id")
      .eq("user_id", userId)
      .eq("kotgroup_id", expense.kotgroup_id)
      .maybeSingle();

    if (!memberRow) {
      res.status(403).json({ error: "Geen toegang." });
      return;
    }

    const { error } = await supabaseAdmin
      .from("expenses")
      .delete()
      .eq("id", expenseId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(204).send();
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});
