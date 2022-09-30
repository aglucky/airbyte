import classNames from "classnames";
import React, { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link, Outlet, useLocation } from "react-router-dom";

import { LoadingPage } from "components";
import { AlertBanner } from "components/base/Banner/AlertBanner";
import { useExperimentSpeedyConnection } from "components/experiments/SpeedyConnection/hooks/use-experiment-speedy-connection-experiment";
import { SpeedyConnectionBanner } from "components/experiments/SpeedyConnection/SpeedyConnectionBanner";

import { CloudRoutes } from "packages/cloud/cloudRoutes";
import { CreditStatus } from "packages/cloud/lib/domain/cloudWorkspaces/types";
import { useGetCloudWorkspace } from "packages/cloud/services/workspaces/CloudWorkspacesService";
import SideBar from "packages/cloud/views/layout/SideBar";
import { useCurrentWorkspace, useCurrentWorkspaceState } from "services/workspaces/WorkspacesService";
import { ResourceNotFoundErrorBoundary } from "views/common/ResorceNotFoundErrorBoundary";
import { StartOverErrorView } from "views/common/StartOverErrorView";

import { InsufficientPermissionsErrorBoundary } from "./InsufficientPermissionsErrorBoundary";
import styles from "./MainView.module.scss";

const MainView: React.FC<React.PropsWithChildren<unknown>> = (props) => {
  const { formatMessage } = useIntl();
  const workspace = useCurrentWorkspace();
  const cloudWorkspace = useGetCloudWorkspace(workspace.workspaceId);
  const showCreditsBanner =
    cloudWorkspace.creditStatus &&
    [
      CreditStatus.NEGATIVE_BEYOND_GRACE_PERIOD,
      CreditStatus.NEGATIVE_MAX_THRESHOLD,
      CreditStatus.NEGATIVE_WITHIN_GRACE_PERIOD,
    ].includes(cloudWorkspace.creditStatus) &&
    !Boolean(cloudWorkspace.trialExpiryTimestamp);

  const alertToShow = showCreditsBanner
    ? "credits"
    : Boolean(cloudWorkspace.trialExpiryTimestamp)
    ? "trial"
    : undefined;

  // exp-speedy-connection
  const { isExperimentVariant } = useExperimentSpeedyConnection();
  const location = useLocation();
  const { hasConnections } = useCurrentWorkspaceState();
  const showExperimentBanner =
    isExperimentVariant &&
    !location.pathname.includes("onboarding") &&
    !location.pathname.includes("new") &&
    !hasConnections;

  // TODO move to signup
  // localStorage.setItem(
  //   "exp-speedy-connection-timestamp",
  //   JSON.stringify(new Date(new Date().getTime() + 2 * 60 * 60 * 1000))
  // );

  const alertMessage = useMemo(() => {
    if (alertToShow === "credits") {
      return (
        <FormattedMessage
          id={`credits.creditsProblem.${cloudWorkspace.creditStatus}`}
          values={{
            lnk: (content: React.ReactNode) => <Link to={CloudRoutes.Credits}>{content}</Link>,
          }}
        />
      );
    } else if (alertToShow === "trial") {
      const { trialExpiryTimestamp } = cloudWorkspace;

      // calculate difference between timestamp (in epoch milliseconds) and now (in epoch milliseconds)
      // empty timestamp is 0
      const trialRemainingMilliseconds = trialExpiryTimestamp ? trialExpiryTimestamp - Date.now() : 0;

      // calculate days (rounding up if decimal)
      const trialRemainingDays = Math.ceil(trialRemainingMilliseconds / (1000 * 60 * 60 * 24));

      return formatMessage({ id: "trial.alertMessage" }, { value: trialRemainingDays });
    }
    return null;
  }, [alertToShow, cloudWorkspace, formatMessage]);

  return (
    <div className={styles.mainContainer}>
      <InsufficientPermissionsErrorBoundary errorComponent={<StartOverErrorView />}>
        <SideBar />
        <div className={classNames(styles.content, { [styles.alertBanner]: !!alertToShow })}>
          {showExperimentBanner ? <SpeedyConnectionBanner /> : alertToShow && <AlertBanner message={alertMessage} />}
          <div className={styles.dataBlock}>
            <ResourceNotFoundErrorBoundary errorComponent={<StartOverErrorView />}>
              <React.Suspense fallback={<LoadingPage />}>{props.children ?? <Outlet />}</React.Suspense>
            </ResourceNotFoundErrorBoundary>
          </div>
        </div>
      </InsufficientPermissionsErrorBoundary>
    </div>
  );
};

export default MainView;
