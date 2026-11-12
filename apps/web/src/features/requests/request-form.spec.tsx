import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequestForm } from "./request-form";

describe("RequestForm", () => {
  it("submits the guided business request fields to the caller", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<RequestForm onSubmit={submit} />);

    fireEvent.change(screen.getByLabelText("需求标题"), { target: { value: "整理竞品资料" } });
    fireEvent.change(screen.getByLabelText("现在遇到的问题"), { target: { value: "资料分散且难以检索" } });
    fireEvent.change(screen.getByLabelText("业务背景"), { target: { value: "用于季度市场分析" } });
    fireEvent.change(screen.getByLabelText("期望成果"), { target: { value: "形成可复用的结构化摘要" } });
    fireEvent.click(screen.getByRole("button", { name: "创建并开始诊断" }));

    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      title: "整理竞品资料",
      problem: "资料分散且难以检索",
      businessContext: "用于季度市场分析",
      expectedOutcome: "形成可复用的结构化摘要",
    })));
  });

  it("surfaces API errors and keeps the entered content", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("需求创建失败"));
    render(<RequestForm onSubmit={submit} />);
    const title = screen.getByLabelText("需求标题");
    fireEvent.change(title, { target: { value: "整理竞品资料" } });
    fireEvent.change(screen.getByLabelText("现在遇到的问题"), { target: { value: "资料分散且难以检索" } });
    fireEvent.change(screen.getByLabelText("业务背景"), { target: { value: "用于季度市场分析" } });
    fireEvent.change(screen.getByLabelText("期望成果"), { target: { value: "形成可复用的结构化摘要" } });
    fireEvent.click(screen.getByRole("button", { name: "创建并开始诊断" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("需求创建失败");
    expect(title).toHaveValue("整理竞品资料");
  });
});
