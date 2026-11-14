import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateSoldierAction, updateStaffAction } from "@/app/actions/personnel-actions";
import { SoldierForm } from "@/components/forms/soldier-form";
import { StaffForm } from "@/components/forms/staff-form";
import { PageHeader } from "@/components/ui/layout";
import { ROLE_DEFINITIONS, ROLE_IDS } from "@/lib/domain/roles";
import { getPersonProfile } from "@/lib/services/personnel-service";

export const metadata: Metadata = { title: "Edit personnel" };

export default async function EditPersonPage({ params }: PageProps<"/personnel/[id]/edit">) {
  const { id } = await params;
  const profile = await getPersonProfile(id);
  if (!profile) notFound();
  const { person } = profile;
  const back = `/personnel/${person.id}`;

  return (
    <>
      <PageHeader
        eyebrow={`Personnel / ${person.displayId} / Edit`}
        title={`Edit ${person.fullName}`}
        description="Display ID, internal ID and service number are permanent. Changes are recorded in the activity log."
      />
      <div className="max-w-5xl">
        {person.category === "SOLDIER" ? (
          <SoldierForm
            action={updateSoldierAction.bind(null, person.id)}
            mode="edit"
            serviceNumber={person.serviceNumber}
            cancelHref={back}
            initial={{
              fullName: person.fullName,
              rank: person.rank,
              unit: person.unit,
              dateOfBirth: person.soldier.dateOfBirth ?? "",
              sex: person.soldier.sex,
              photo: person.soldier.photo ?? "",
              bloodGroup: person.soldier.bloodGroup,
              rhFactor: person.soldier.rhFactor,
              medicalCategory: person.soldier.medicalCategory,
              identificationMarks: person.soldier.identificationMarks,
              nextOfKinName: person.soldier.nextOfKin.name,
              nextOfKinRelationship: person.soldier.nextOfKin.relationship,
              nextOfKinPhone: person.soldier.nextOfKin.phone,
              contactPhone: person.contactPhone,
              status: person.status,
            }}
          />
        ) : (
          <StaffForm
            action={updateStaffAction.bind(null, person.id)}
            mode="edit"
            serviceNumber={person.serviceNumber}
            cancelHref={back}
            roles={ROLE_IDS.filter(r => ROLE_DEFINITIONS[r].category === person.category).map(r => ({
              value: r,
              label: ROLE_DEFINITIONS[r].label,
              description: ROLE_DEFINITIONS[r].description,
            }))}
            initial={{
              fullName: person.fullName,
              rank: person.rank,
              unit: person.unit,
              role: person.staff.role,
              photo: person.staff.photo ?? "",
              dateOfBirth: person.staff.dateOfBirth ?? "",
              designation: person.staff.designation,
              professionalRegistration: person.staff.professionalRegistration,
              contactPhone: person.contactPhone,
              status: person.status,
            }}
          />
        )}
      </div>
    </>
  );
}
