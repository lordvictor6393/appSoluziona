import { FundingRequest } from "./funding-request.model";
import { AngularFirestore, AngularFirestoreCollection } from "../../../node_modules/angularfire2/firestore";
import { Observable } from "../../../node_modules/rxjs";
import { map, filter } from "../../../node_modules/rxjs/operators";
import { Injectable } from "../../../node_modules/@angular/core";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class FundingRequestService {
    private localFrList: FundingRequest[] = [];
    private frCollectionRef: AngularFirestoreCollection<FundingRequest>;

    constructor(private authService: AuthService,
        private db: AngularFirestore) {
        const me = this;
        me.frCollectionRef = me.db.collection('fundingRequests', ref => ref.where('isDeleted', '==', false));
        me.frCollectionRef.snapshotChanges().subscribe(
            frList => {
                me.localFrList = frList.map(FundingRequest.getFrFromSnapshot);
            }
        );
    }

    getListRestrictions() {
        const me = this;
        let user = this.authService.loggedUserInstance;
        if (user) {
            if (me.authService.CanManageAllFrEr() || user.leadOf.length) {
                return ref => ref.where('isDeleted', '==', false);
            } else {
                return ref => ref
                    .where('isDeleted', '==', false)
                    .where('createUserId', '==', me.authService.loggedUserId);
            }
        }
    }

    getFrList(): Observable<FundingRequest[]> {
        const me = this;
        let user = this.authService.loggedUserInstance;
        if (user) {
            return me.db.collection('fundingRequests', me.getListRestrictions()).snapshotChanges().pipe(
                map(frList => frList.map(FundingRequest.getFrFromSnapshot)),
                map(frList => {
                    let filteredList = frList.filter(
                        fr => {
                            if(me.authService.CanManageAllFrEr()) return true;
                            if(user.leadOf.length) {
                                return  user.id == fr.createUserId || 
                                        (user.leadOf.indexOf(fr.projectId) !== -1 
                                         && fr.isSent)
                            }
                            return true;
                        }
                    )
                    return filteredList;
                })
            );
        }
    }

    getFr(frId: string): Observable<FundingRequest> {
        const me = this;
        let frRef = me.db.doc('fundingRequests/' + frId);
        if (frRef) {
            return frRef.valueChanges().pipe(
                map(fr => {
                    if (fr) {
                        return FundingRequest.getFrFromValue(frId, fr);
                    }
                })
            );
        } else {
            console.error('Not able to get funding request ' + frId + ' from db');
        }
    }

    addFr(frData) {
        const me = this;
        frData.isDeleted = false;
        frData.isSent = false;
        frData.state = 'Creado';
        frData.date = frData.date.getTime();
        me.frCollectionRef.add(frData);
    }

    updateFr(frId, frData) {
        const me = this;
        let frRef = me.db.doc('fundingRequests/' + frId);
        if (frRef) {
            if(frData.data) frData.date = frData.date.getTime();
            frRef.update(frData);
        } else {
            console.log('Cannot update funding request, not able to get funding request ' + frId);
        }
    }

    sendFr(frId: string) {
        const me = this;
        me.updateFr(frId, { isSent: true, state: 'Enviado' });
    }

    deleteFr(frId: string) {
        const me = this;
        me.updateFr(frId, { isDeleted: true });
    }

    generateFrCode(): string {
        const me = this;
        return 'SOL-' + (me.localFrList.length + 1);
    }
}