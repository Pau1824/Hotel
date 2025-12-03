import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IaHelp } from './ia-help';

describe('IaHelp', () => {
  let component: IaHelp;
  let fixture: ComponentFixture<IaHelp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IaHelp]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IaHelp);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
