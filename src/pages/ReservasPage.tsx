import ReservasPdfGuard from "../components/admin/ReservasPdfGuard";
import UrgentReservationApprovalAlert from "../components/admin/UrgentReservationApprovalAlert";

export default function ReservasPage() {
  return (
    <div className="p-4">
      <UrgentReservationApprovalAlert />
      <ReservasPdfGuard />
    </div>
  );
}
