import { Alert } from "react-native";
import {
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from "expo-router/testing-library";
import Layout from "../app/_layout";
import CalendarScreen from "../app/index";
import EventScreen from "../app/event";
import SettingsScreen from "../app/settings";
const mockEvent = {
  id: "existing",
  date: "2028-02-29",
  title: "准备面试",
  note: "带上材料\n提前十分钟到达",
  isAllDay: false,
  startTime: "09:00",
  endTime: "10:00",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};
const mockRepository = {
  month: jest.fn(),
  get: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  all: jest.fn(),
  import: jest.fn(),
};
const mockChanged = jest.fn();
jest.mock("../src/store", () => ({
  StoreProvider: ({ children }: { children: unknown }) => children,
  useStore: () => ({
    repository: mockRepository,
    revision: 0,
    changed: mockChanged,
  }),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => "new-id" }));
const routes = {
  _layout: Layout,
  index: CalendarScreen,
  event: EventScreen,
  settings: SettingsScreen,
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2028, 1, 29, 12));
  jest.clearAllMocks();
  mockRepository.month.mockResolvedValue([mockEvent]);
  mockRepository.get.mockResolvedValue(mockEvent);
  mockRepository.save.mockResolvedValue(undefined);
  mockRepository.remove.mockResolvedValue(undefined);
  mockRepository.all.mockResolvedValue([mockEvent]);
});
afterEach(() => {
  jest.restoreAllMocks();
});
test("real Router renders local calendar, marks entries, switches months and returns today", async () => {
  await renderRouter(routes);
  expect(await screen.findByText("2028年2月")).toBeTruthy();
  expect(await screen.findByText("准备面试")).toBeTruthy();
  expect(screen.getByLabelText("2028-02-29，今天，有安排")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("下个月"));
  expect(await screen.findByText("2028年3月")).toBeTruthy();
  await waitFor(() =>
    expect(mockRepository.month).toHaveBeenLastCalledWith("2028-03"),
  );
  await fireEvent.press(screen.getByText("今天"));
  expect(await screen.findByText("2028年2月")).toBeTruthy();
});
test("new event validates title and times then saves the selected date and multiline note", async () => {
  await renderRouter(routes, { initialUrl: "/event?date=2028-02-29" });
  await fireEvent.press(screen.getByText("保存安排"));
  expect(await screen.findByText("请填写日程标题")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("日程标题"), "去医院");
  await fireEvent.changeText(
    screen.getByLabelText("详细备注"),
    "第一行\n第二行",
  );
  await fireEvent.changeText(
    screen.getByLabelText("开始时间，24 小时制"),
    "10:00",
  );
  await fireEvent.changeText(
    screen.getByLabelText("结束时间，24 小时制"),
    "09:00",
  );
  await fireEvent.press(screen.getByText("保存安排"));
  expect(await screen.findByText("结束时间不能早于开始时间")).toBeTruthy();
  expect(mockRepository.save).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("结束时间，24 小时制"),
    "11:00",
  );
  await fireEvent.press(screen.getByText("保存安排"));
  await waitFor(() =>
    expect(mockRepository.save).toHaveBeenCalledWith(
      "new-id",
      expect.objectContaining({
        date: "2028-02-29",
        title: "去医院",
        note: "第一行\n第二行",
        startTime: "10:00",
        endTime: "11:00",
      }),
      undefined,
      false,
    ),
  );
  expect(mockChanged).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("我的日历")).toBeTruthy();
});
test("edit loads full notes and shows delete confirmation before any delete", async () => {
  const alert = jest.spyOn(Alert, "alert");
  await renderRouter(routes, { initialUrl: "/event?id=existing" });
  expect(await screen.findByDisplayValue(mockEvent.note)).toBeTruthy();
  await fireEvent.press(screen.getByText("删除这条安排"));
  expect(alert).toHaveBeenCalledWith(
    "删除这条安排？",
    expect.any(String),
    expect.any(Array),
  );
  expect(mockRepository.remove).not.toHaveBeenCalled();
});
test("unsaved navigation uses the Router prevention context and asks before leaving", async () => {
  const alert = jest.spyOn(Alert, "alert");
  await renderRouter(routes);
  await fireEvent.press(screen.getByLabelText("为2028-02-29添加日程"));
  await fireEvent.changeText(
    await screen.findByLabelText("日程标题"),
    "尚未保存",
  );
  await fireEvent.press(screen.getByText("‹ 返回"));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith(
      "放弃未保存的修改？",
      expect.any(String),
      expect.any(Array),
    ),
  );
  expect(mockRepository.save).not.toHaveBeenCalled();
});
