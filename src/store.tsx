import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";
import { EventRepository, migrate } from "./database";
import { ui, colors } from "./theme";
type Store = {
  repository: EventRepository;
  revision: number;
  changed: () => void;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [repository, setRepository] = useState<EventRepository | null>(null);
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  const [revision, setRevision] = useState(0);
  const changed = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let disposed = false;
    let settled = false;
    let connection: SQLiteDatabase | undefined;
    setError("");
    void (async () => {
      try {
        connection = await openDatabaseAsync("my-calendar.db");
        await migrate(connection);
        if (!disposed) setRepository(new EventRepository(connection));
      } catch {
        if (!disposed)
          setError(
            "本地数据库暂时无法打开。你的数据不会被清除，请重试或重新打开应用。",
          );
        if (connection) {
          await connection.closeAsync();
          connection = undefined;
        }
      } finally {
        settled = true;
        if (disposed && connection) await connection.closeAsync();
      }
    })();
    return () => {
      disposed = true;
      if (settled && connection) void connection.closeAsync().catch(() => {});
    };
  }, [attempt]);
  if (!repository)
    return (
      <View style={ui.center}>
        {error ? (
          <>
            <Text style={ui.heading}>暂时无法打开日历</Text>
            <Text style={ui.error}>{error}</Text>
            <Pressable style={ui.button} onPress={() => retry((x) => x + 1)}>
              <Text style={ui.buttonText}>重试</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={ui.sub}>正在整理你的日历…</Text>
          </>
        )}
      </View>
    );
  return (
    <Context.Provider value={{ repository, revision, changed }}>
      {children}
    </Context.Provider>
  );
}
export function useStore(): Store {
  const store = useContext(Context);
  if (!store) throw new Error("数据库尚未准备好");
  return store;
}
