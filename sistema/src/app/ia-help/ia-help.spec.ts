import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IaHelpComponent } from './ia-help.component';

describe('IaHelpComponent', () => {
  let component: IaHelpComponent;
  let fixture: ComponentFixture<IaHelpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IaHelpComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IaHelpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
