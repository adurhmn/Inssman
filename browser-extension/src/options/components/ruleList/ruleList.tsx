import TrackService from "@services/TrackService";
import List from "@options/components/common/list/list";
import { FC, ReactElement, useState } from "react";
import { PostMessageAction } from "@models/postMessageActionModel";
import { IRuleMetaData, PageName } from "@models/formFieldModel";
import { SortState, SortColumn } from "@models/sortModel";
import { LIST_HEADERS, LIST_ITEMS } from "./list.config";
import { generateLastMatchedTime } from "@/utils/generateLastMatchedTime";
import { cutString } from "@/utils/cutString";
import { sortRules, getNextSortState } from "@/utils/sortRules";

type Props = {
  rules: IRuleMetaData[];
  getRules: () => void;
  search?: string;
  listClasses?: string;
  columns?: [];
  page?: string;
};

const RuleList: FC<Props> = ({ rules, getRules, search = "", listClasses = "", page = "options" }): ReactElement => {
  const [sortState, setSortState] = useState<SortState | null>(null);

  const handleSort = (column: SortColumn) => {
    setSortState(getNextSortState(sortState, column));
  };

  const duplicateRule = (ruleMetaData: IRuleMetaData): void =>
    chrome.runtime.sendMessage({ action: PostMessageAction.DuplicateRule, data: { ruleMetaData } }, () => getRules());
  const handleToggleRule = (event, ruleMetaData): void => {
    chrome.runtime.sendMessage(
      {
        action: PostMessageAction.ToggleRule,
        data: { ruleMetaData, checked: event.target.checked },
      },
      () => getRules()
    );
  };

  const handleDelete = (ruleMetaData) => {
    TrackService.trackEvent(`${PageName[ruleMetaData.pageType]} Rule Delete Event`);
    chrome.runtime.sendMessage(
      {
        action: PostMessageAction.DeleteRule,
        data: { id: ruleMetaData.id, connectedRuleIds: ruleMetaData.connectedRuleIds },
      },
      () => getRules()
    );
  };

  const filteredList = sortRules(
    rules.filter((ruleMetaData) => ruleMetaData.name.includes(search)),
    sortState
  );
  const title = rules.length ? `No Rule found for "${search}"` : "Seems You Have Not Created a Rule Yet";
  const description = rules.length
    ? ""
    : page === "options"
    ? "Please Select One Of Rule In The Sidebar To Create Or Choose a Templates"
    : 'Please Select One Of Rule In The "Create Rule" Tab To Create';

  return (
    <List
      headers={LIST_HEADERS}
      items={LIST_ITEMS}
      data={filteredList}
      listClasses={listClasses}
      sortState={sortState}
      onSort={handleSort}
      options={{
        handleDelete,
        handleToggleRule,
        generateLastMatchedTime,
        duplicateRule,
        cutString,
      }}
      texts={{
        title,
        description,
      }}
    />
  );
};

export default RuleList;
