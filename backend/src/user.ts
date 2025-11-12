// {
//   "checkingStatus": "pending",
//   "eventCategory": "Technical",
//   "eventId": "mirage",
//   "eventName": "Mirage",
//   "eventType": "team",
//   "paymentDetails": null,
//   "registeredAt": "2025-11-08T14:44:15.438Z",
//   "teamId": "320482",
//   "teamInviteCode": "320482",
//   "user": {
//     "collegeName": "Thapar Institute of Engineering and Technology",
//     "email": "apatidar_be25@thapar.edu",
//     "name": "Ankur Patidar",
//     "phoneNumber": "9589025566",
//     "rollNumber": "1025090076",
//     "userId": "06CuRO56iQXCjCUhgkJeUMbEtVD2"
//   }
// }

import { z } from "zod";

export default z.looseObject({
  teamId: z.string().regex(/^mirage_/),
});
