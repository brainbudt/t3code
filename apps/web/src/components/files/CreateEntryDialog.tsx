import type { EnvironmentId, ProjectEntry } from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { projectEnvironment } from "~/state/projects";
import { useAtomCommand } from "~/state/use-atom-command";

import { resolveNewEntryPath } from "./fileTreeCreateEntry";

export interface CreateEntryRequest {
  readonly kind: ProjectEntry["kind"];
  /** Workspace-relative folder; empty for the workspace root. */
  readonly parentPath: string;
}

export function CreateEntryDialog(props: {
  environmentId: EnvironmentId;
  cwd: string;
  projectName: string;
  request: CreateEntryRequest | null;
  onClose: () => void;
  /** Runs when the dialog has closed; return focus to the tree instead of the app default. */
  onRestoreFocus: () => void;
  onCreated: (relativePath: string, request: CreateEntryRequest) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createEntry = useAtomCommand(projectEnvironment.createEntry, { reportFailure: false });

  const [requestSeen, setRequestSeen] = useState(props.request);
  if (requestSeen !== props.request) {
    setRequestSeen(props.request);
    setName("");
    setDirty(false);
    setSubmitError(null);
  }

  const request = props.request;
  const resolved = request ? resolveNewEntryPath(request.parentPath, name) : null;
  const isFolder = request?.kind === "directory";
  const validation = dirty && resolved && "error" in resolved ? resolved.error : null;

  const submit = async () => {
    setDirty(true);
    if (!request || !resolved || "error" in resolved) return;
    setSubmitError(null);
    setPending(true);
    const result = await createEntry({
      environmentId: props.environmentId,
      input: { cwd: props.cwd, relativePath: resolved.relativePath, kind: request.kind },
    });
    setPending(false);
    if (result._tag === "Success") {
      props.onClose();
      props.onCreated(result.value.relativePath, request);
      return;
    }
    if (isAtomCommandInterrupted(result)) return;
    const error = squashAtomCommandFailure(result);
    setSubmitError(error instanceof Error ? error.message : "Could not create it.");
  };

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !pending) props.onClose();
      }}
      // The rest of the page is inert until the close finishes, so focus can only move then.
      onOpenChangeComplete={(open) => {
        if (!open) props.onRestoreFocus();
      }}
    >
      <DialogPopup className="max-w-md" initialFocus={inputRef} finalFocus={false}>
        <DialogHeader>
          <DialogTitle>{isFolder ? "New folder" : "New file"}</DialogTitle>
          <DialogDescription>
            In{" "}
            {request?.parentPath ? `${props.projectName}/${request.parentPath}` : props.projectName}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <Input
            ref={inputRef}
            aria-label={isFolder ? "Folder name" : "File name"}
            placeholder={isFolder ? "folder-name" : "file-name.ts"}
            spellCheck={false}
            autoComplete="off"
            value={name}
            onChange={(event) => {
              setDirty(true);
              setSubmitError(null);
              setName(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void submit();
            }}
          />
          {(validation ?? submitError) ? (
            <p role="alert" className="text-destructive text-xs">
              {validation ?? submitError}
            </p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={props.onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={pending || resolved === null || "error" in resolved}
          >
            {pending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
