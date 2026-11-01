import { mountApp } from "./app";
import { TodoStore } from "./todo";

const root = document.getElementById("root");
if (root) mountApp(root, new TodoStore(localStorage));
